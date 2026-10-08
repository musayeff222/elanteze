import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, uploadFile } from "../api";
import { Seo } from "../components/Seo";
import { Button, Empty, FullSpinner, inputClass } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { formatPrice, formatWhen, fullName } from "../format";
import { ChatMessage, Conversation, User } from "../types";

type Thread = {
  messages: ChatMessage[];
  conversation: {
    id: string;
    listing: Conversation["listing"];
    buyer: User;
    seller: User;
  };
};

export function MessagesPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const client = useQueryClient();
  const { push } = useToast();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<{ items: Conversation[] }>("/api/conversations"),
  });
  const thread = useQuery({
    queryKey: ["thread", id],
    enabled: Boolean(id),
    queryFn: () => api<Thread>(`/api/conversations/${id}/messages`),
  });

  useEffect(() => {
    if (!socket) return;
    const refreshList = () => client.invalidateQueries({ queryKey: ["conversations"] });
    socket.on("message:new", refreshList);
    return () => {
      socket.off("message:new", refreshList);
    };
  }, [socket, client]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("conversation:join", id);
    api(`/api/conversations/${id}/read`, { method: "POST" }).then(() => client.invalidateQueries({ queryKey: ["conversations"] })).catch(() => undefined);
    const onMessage = (message: ChatMessage) => {
      if (message.conversationId !== id) return;
      client.setQueryData(["thread", id], (current: Thread | undefined) => {
        if (!current) return current;
        if (current.messages.some((item) => item.id === message.id)) return current;
        return { ...current, messages: [...current.messages, { ...message, mine: message.senderId === user?.id }] };
      });
      api(`/api/conversations/${id}/read`, { method: "POST" }).catch(() => undefined);
    };
    const onSeen = () => client.invalidateQueries({ queryKey: ["thread", id] });
    const onTyping = (payload: { conversationId: string; typing: boolean }) => {
      if (payload.conversationId === id) setTyping(payload.typing);
    };
    socket.on("message:new", onMessage);
    socket.on("message:seen", onSeen);
    socket.on("typing", onTyping);
    return () => {
      socket.emit("conversation:leave", id);
      socket.emit("typing:stop", id);
      socket.off("message:new", onMessage);
      socket.off("message:seen", onSeen);
      socket.off("typing", onTyping);
      setTyping(false);
    };
  }, [socket, id, client, user?.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data?.messages.length, typing]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (conversations.data?.items || []).filter((item) => {
      if (onlyUnread && item.unread < 1) return false;
      if (!needle) return true;
      const haystack = `${fullName(item.other)} ${item.listing.title} ${item.lastMessage?.body || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [conversations.data?.items, onlyUnread, query]);

  async function send(event?: FormEvent, imageUrl?: string) {
    event?.preventDefault();
    if (!id || sending || (!text.trim() && !imageUrl)) return;
    const body = text.trim();
    setText("");
    setSending(true);
    socket?.emit("typing:stop", id);
    try {
      const data = await api<{ message: ChatMessage }>(`/api/messages`, {
        method: "POST",
        body: JSON.stringify({ conversationId: id, body: body || undefined, imageUrl }),
      });
      client.setQueryData(["thread", id], (current: Thread | undefined) => {
        if (!current) return current;
        if (current.messages.some((item) => item.id === data.message.id)) {
          return { ...current, messages: current.messages.map((item) => (item.id === data.message.id ? data.message : item)) };
        }
        return { ...current, messages: [...current.messages, data.message] };
      });
      client.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      if (!imageUrl) setText(body);
      push(error instanceof Error ? error.message : "Mesaj göndərilmədi");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  async function sendImage(file: File) {
    try {
      const uploaded = await uploadFile("/api/uploads/image", file);
      await send(undefined, uploaded.url);
    } catch (error) {
      push(error instanceof Error ? error.message : "Şəkil göndərilmədi");
    }
  }

  const other = thread.data
    ? thread.data.conversation.buyer.id === user?.id
      ? thread.data.conversation.seller
      : thread.data.conversation.buyer
    : undefined;
  const cover = thread.data?.conversation.listing.images?.[0];

  return (
    <div className="grid overflow-hidden rounded-3xl border border-black/5 bg-white shadow-card md:h-[calc(100vh-8.5rem)] md:grid-cols-[340px_1fr]">
      <Seo title="Mesajlar" />
      <aside className={`${id ? "hidden md:flex" : "flex"} min-h-[70vh] flex-col border-r border-black/5 md:min-h-0`}>
        <div className="border-b border-black/5 px-4 py-4">
          <h1 className="text-lg font-extrabold">Mesajlar</h1>
          <input
            className={`${inputClass} mt-3`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad, elan və ya mesaj"
          />
          <div className="mt-3 flex gap-2">
            <Filter active={!onlyUnread} onClick={() => setOnlyUnread(false)}>Hamısı</Filter>
            <Filter active={onlyUnread} onClick={() => setOnlyUnread(true)}>Oxunmamış</Filter>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations.isLoading ? <FullSpinner /> : null}
          {!conversations.isLoading && items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-mist">{query || onlyUnread ? "Uyğun yazışma yoxdur." : "Hələ yazışma yoxdur. Elan səhifəsindən satıcıya yazın."}</p>
          ) : null}
          {items.map((item) => {
            const thumb = item.listing.images?.[0]?.thumbnailUrl;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/mesajlar/${item.id}`)}
                className={`flex w-full gap-3 border-b border-black/5 px-4 py-3 text-left hover:bg-paper ${item.id === id ? "bg-brand-50" : ""}`}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 font-bold text-brand-800">{fullName(item.other).slice(0, 1)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{fullName(item.other)}</span>
                    <span className="shrink-0 text-[11px] text-mist">{formatWhen(item.lastMessage?.createdAt || item.lastMessageAt)}</span>
                  </span>
                  <span className="block truncate text-xs text-mist">{item.listing.title} · {formatPrice(item.listing.price)}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${item.unread ? "font-semibold" : "text-mist"}`}>
                      {item.lastMessage?.mine ? "Siz: " : ""}
                      {item.lastMessage?.body || (item.lastMessage?.imageUrl ? "Şəkil" : "Yazışma açıldı")}
                    </span>
                    {item.unread > 0 ? <span className="rounded-full bg-brand-700 px-2 text-xs text-white">{item.unread}</span> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <section className={`${id ? "flex" : "hidden md:flex"} min-h-[70vh] flex-col md:min-h-0`}>
        {!id ? (
          <div className="grid flex-1 place-items-center p-6">
            <Empty title="Yazışma seçin" text="Soldakı siyahıdan söhbəti açın." />
          </div>
        ) : null}
        {id && thread.isLoading ? <FullSpinner /> : null}
        {id && thread.isError ? <p className="p-6 text-sm">Yazışma açılmadı.</p> : null}
        {id && thread.data && other ? (
          <>
            <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
              {cover?.thumbnailUrl ? <img src={cover.thumbnailUrl} alt="" className="h-12 w-14 rounded-xl object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <Link to={`/elan/${thread.data.conversation.listing.slug}`} className="block truncate font-semibold">{thread.data.conversation.listing.title}</Link>
                <p className="truncate text-xs text-mist">
                  {formatPrice(Number(thread.data.conversation.listing.price))} · {fullName(other)} · {other.isOnline ? "onlayn" : "oflayn"}
                </p>
              </div>
              <Link to={`/istifadeci/${other.id}`} className="hidden text-sm font-semibold text-brand-800 sm:inline">Profil</Link>
              <Link to="/mesajlar" className="text-sm font-semibold md:hidden">Siyahı</Link>
            </div>
            <div className="flex-1 space-y-2 overflow-auto bg-[#f7f8f8] p-4">
              {thread.data.messages.length === 0 ? <p className="text-center text-sm text-mist">İlk mesajı siz yazın.</p> : null}
              {thread.data.messages.map((message) => (
                <div key={message.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.mine ? "ml-auto bg-brand-700 text-white" : "bg-white"}`}>
                  {message.imageUrl ? <img src={message.imageUrl} alt="" className="mb-2 max-h-48 rounded-xl" /> : null}
                  {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
                  <p className={`mt-1 text-[11px] ${message.mine ? "text-white/70" : "text-mist"}`}>
                    {formatWhen(message.createdAt)} {message.mine ? (message.seenAt ? "· oxundu" : message.deliveredAt ? "· çatdı" : "· göndərildi") : ""}
                  </p>
                </div>
              ))}
              {typing ? <p className="text-xs text-mist">{fullName(other)} yazır...</p> : null}
              <div ref={bottom} />
            </div>
            <form onSubmit={(event) => void send(event)} className="flex items-end gap-2 border-t border-black/5 p-3">
              <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-paper text-sm font-bold" title="Şəkil göndər">
                +
                <input
                  className="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void sendImage(file);
                  }}
                />
              </label>
              <textarea
                className={`${inputClass} max-h-32 min-h-11 resize-none`}
                value={text}
                rows={1}
                placeholder="Mesaj yazın"
                onChange={(event) => {
                  setText(event.target.value);
                  socket?.emit(event.target.value ? "typing:start" : "typing:stop", id);
                }}
                onKeyDown={onKeyDown}
              />
              <Button type="submit" disabled={sending || !text.trim()}>Göndər</Button>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}

function Filter({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#0c1412] text-white" : "bg-paper"}`}>
      {children}
    </button>
  );
}
