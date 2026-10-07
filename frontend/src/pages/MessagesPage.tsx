import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, uploadFile } from "../api";
import { Seo } from "../components/Seo";
import { Button, Empty, FullSpinner, inputClass } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { formatPrice, formatWhen, fullName } from "../format";
import { ChatMessage, Conversation } from "../types";

export function MessagesPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const client = useQueryClient();
  const { push } = useToast();
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<{ items: Conversation[] }>("/api/conversations"),
  });
  const thread = useQuery({
    queryKey: ["thread", id],
    enabled: Boolean(id),
    queryFn: () => api<{ messages: ChatMessage[]; conversation: { id: string; listing: Conversation["listing"]; buyer: Conversation["other"]; seller: Conversation["other"] } }>(`/api/conversations/${id}/messages`),
  });

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("conversation:join", id);
    api(`/api/conversations/${id}/read`, { method: "POST" }).catch(() => undefined);
    const onMessage = (message: ChatMessage) => {
      if (message.conversationId !== id) return;
      client.setQueryData(["thread", id], (current: { messages: ChatMessage[]; conversation: unknown } | undefined) => {
        if (!current) return current;
        if (current.messages.some((item) => item.id === message.id)) return current;
        return { ...current, messages: [...current.messages, { ...message, mine: message.senderId === user?.id }] };
      });
      api(`/api/conversations/${id}/read`, { method: "POST" }).catch(() => undefined);
      client.invalidateQueries({ queryKey: ["conversations"] });
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
      socket.off("message:new", onMessage);
      socket.off("message:seen", onSeen);
      socket.off("typing", onTyping);
    };
  }, [socket, id, client, user?.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data?.messages.length]);

  async function send(event?: FormEvent, imageUrl?: string) {
    event?.preventDefault();
    if (!id || (!text.trim() && !imageUrl)) return;
    const body = text.trim();
    setText("");
    socket?.emit("typing:stop", id);
    try {
      const data = await api<{ message: ChatMessage }>(`/api/messages`, {
        method: "POST",
        body: JSON.stringify({ conversationId: id, body, imageUrl }),
      });
      client.setQueryData(["thread", id], (current: { messages: ChatMessage[]; conversation: unknown } | undefined) => {
        if (!current) return current;
        if (current.messages.some((item) => item.id === data.message.id)) {
          return { ...current, messages: current.messages.map((item) => (item.id === data.message.id ? data.message : item)) };
        }
        return { ...current, messages: [...current.messages, data.message] };
      });
      client.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      push(error instanceof Error ? error.message : "Mesaj göndərilmədi");
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

  const active = conversations.data?.items.find((item) => item.id === id);

  return (
    <div className="grid overflow-hidden rounded-3xl bg-white shadow-card md:h-[70vh] md:grid-cols-[320px_1fr]">
      <Seo title="Mesajlar" />
      <aside className={`${id ? "hidden md:block" : ""} overflow-auto border-r border-black/5`}>
        <h1 className="px-4 py-4 text-lg font-bold">Mesajlar</h1>
        {conversations.isLoading ? <FullSpinner /> : null}
        {(conversations.data?.items || []).length === 0 ? <p className="px-4 text-sm text-mist">Hələ yazışma yoxdur.</p> : null}
        {conversations.data?.items.map((item) => (
          <button key={item.id} type="button" onClick={() => navigate(`/mesajlar/${item.id}`)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-paper ${item.id === id ? "bg-brand-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{fullName(item.other)}</span>
                {item.unread > 0 ? <span className="rounded-full bg-brand-700 px-2 text-xs text-white">{item.unread}</span> : null}
              </div>
              <p className="truncate text-xs text-mist">{item.listing.title}</p>
              <p className="truncate text-sm">{item.lastMessage?.body || (item.lastMessage?.imageUrl ? "Şəkil" : "Yazışma açıldı")}</p>
            </div>
          </button>
        ))}
      </aside>
      <section className={`${id ? "flex" : "hidden md:flex"} min-h-[60vh] flex-col`}>
        {!id ? <div className="grid flex-1 place-items-center"><Empty title="Yazışma seçin" /></div> : null}
        {id && thread.isLoading ? <FullSpinner /> : null}
        {id && thread.data ? (
          <>
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <div>
                <Link to={`/elan/${thread.data.conversation.listing.slug}`} className="font-semibold">{thread.data.conversation.listing.title}</Link>
                <p className="text-xs text-mist">{formatPrice(Number(thread.data.conversation.listing.price))} · {active?.other.isOnline ? "onlayn" : "oflayn"}</p>
              </div>
              <Link to="/mesajlar" className="text-sm md:hidden">Siyahı</Link>
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-4">
              {thread.data.messages.map((message) => (
                <div key={message.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.mine ? "ml-auto bg-brand-700 text-white" : "bg-paper"}`}>
                  {message.imageUrl ? <img src={message.imageUrl} alt="" className="mb-2 max-h-48 rounded-xl" /> : null}
                  {message.body ? <p>{message.body}</p> : null}
                  <p className={`mt-1 text-[11px] ${message.mine ? "text-white/70" : "text-mist"}`}>
                    {formatWhen(message.createdAt)} {message.mine ? (message.seenAt ? "· oxundu" : message.deliveredAt ? "· çatdı" : "· göndərildi") : ""}
                  </p>
                </div>
              ))}
              {typing ? <p className="text-xs text-mist">Yazır...</p> : null}
              <div ref={bottom} />
            </div>
            <form
              onSubmit={(event) => void send(event)}
              className="flex gap-2 border-t border-black/5 p-3"
            >
              <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-paper text-sm">
                +
                <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && void sendImage(event.target.files[0])} />
              </label>
              <input
                className={inputClass}
                value={text}
                placeholder="Mesaj yazın"
                onChange={(event) => {
                  setText(event.target.value);
                  socket?.emit(event.target.value ? "typing:start" : "typing:stop", id);
                }}
              />
              <Button type="submit">Göndər</Button>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
