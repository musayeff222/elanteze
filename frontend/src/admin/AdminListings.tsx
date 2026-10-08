import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useToast } from "../context/ToastContext";
import { formatDate, formatPrice } from "../format";
import { conditionLabel, reportReasons, statusLabel } from "../labels";
import { Category, City, Listing, ListingStatus } from "../types";

type AdminListing = Listing & { reports?: number; conversations?: number; offers?: number };

type ListResponse = {
  items: AdminListing[];
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
};

type DetailResponse = {
  listing: Listing;
  reports: { id: string; reason: string; details?: string | null; status: string; createdAt: string; reporter: { firstName: string; lastName: string } }[];
  counts: { reports: number; conversations: number; offers: number; favorites: number };
};

const TABS: { value: ListingStatus | ""; label: string }[] = [
  { value: "", label: "Hamısı" },
  { value: "PENDING", label: "Gözləyir" },
  { value: "ACTIVE", label: "Aktiv" },
  { value: "REJECTED", label: "Rədd" },
  { value: "HIDDEN", label: "Gizli" },
  { value: "SOLD", label: "Satılıb" },
  { value: "EXPIRED", label: "Bitib" },
  { value: "DELETED", label: "Silinib" },
];

const QUICK_REASONS = ["Şəkillər uyğun deyil", "Təsvir və ya qiymət natamamdır", "Qadağan olunmuş məhsul", "Təkrar elan", ...reportReasons.map((item) => item.label)];

function tone(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-800";
  if (status === "PENDING") return "bg-amber-50 text-amber-900";
  if (status === "REJECTED" || status === "DELETED") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-700";
}

export function AdminListingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const city = params.get("city") || "";
  const sort = params.get("sort") || "new";
  const featured = params.get("featured") === "1";
  const page = Math.max(1, Number(params.get("page") || 1));
  const [draft, setDraft] = useState(q);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { push } = useToast();
  const client = useQueryClient();

  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== q) apply({ q: draft, page: "1" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  function apply(next: Record<string, string>) {
    const merged: Record<string, string> = {
      status,
      q,
      category,
      city,
      sort: sort === "new" ? "" : sort,
      featured: featured ? "1" : "",
      page: String(page),
      ...next,
    };
    if (merged.sort === "new") merged.sort = "";
    const clean = Object.fromEntries(Object.entries(merged).filter(([, value]) => value && value !== "0"));
    setParams(clean);
  }

  const query = useQuery({
    queryKey: ["admin-listings", status, q, category, city, sort, featured, page],
    queryFn: () => {
      const search = new URLSearchParams();
      if (status) search.set("status", status);
      if (q) search.set("q", q);
      if (category) search.set("category", category);
      if (city) search.set("city", city);
      if (sort !== "new") search.set("sort", sort);
      if (featured) search.set("featured", "1");
      search.set("page", String(page));
      return api<ListResponse>(`/api/admin/listings?${search.toString()}`);
    },
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<{ items: Category[] }>("/api/categories") });
  const cities = useQuery({ queryKey: ["cities"], queryFn: () => api<{ items: City[] }>("/api/cities") });
  const detail = useQuery({
    queryKey: ["admin-listing", openId],
    queryFn: () => api<DetailResponse>(`/api/admin/listings/${openId}`),
    enabled: Boolean(openId),
  });

  const items = query.data?.items || [];
  const counts = query.data?.counts || {};
  const visibleCount = TABS.filter((tab) => tab.value !== "DELETED").reduce((sum, tab) => sum + (tab.value ? counts[tab.value] || 0 : 0), 0);
  const pageIds = items.map((item) => item.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  async function refresh() {
    await Promise.all([
      query.refetch(),
      client.invalidateQueries({ queryKey: ["admin-badges"] }),
      client.invalidateQueries({ queryKey: ["admin-stats"] }),
      openId ? detail.refetch() : Promise.resolve(),
    ]);
  }

  async function act(id: string, action: string, body?: unknown) {
    try {
      const data = await api<{ message: string }>(`/api/admin/listings/${id}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      push(data.message);
      await refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Əməliyyat alınmadı");
    }
  }

  async function bulk(action: string, body?: { reason?: string }, ids = selected) {
    if (!ids.length) return;
    try {
      const data = await api<{ message: string }>("/api/admin/listings/bulk", {
        method: "POST",
        body: JSON.stringify({ ids, action, ...body }),
      });
      push(data.message);
      setSelected([]);
      await refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Toplu əməliyyat alınmadı");
    }
  }

  async function remove(id: string) {
    try {
      const data = await api<{ message: string }>(`/api/admin/listings/${id}`, { method: "DELETE" });
      push(data.message);
      setDeleteId(null);
      if (openId === id) setOpenId(null);
      setSelected((prev) => prev.filter((item) => item !== id));
      await refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Silinmədi");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Elanlar</h1>
          <p className="text-sm text-mist">{query.data ? `${query.data.total} elan bu filtrdə` : "Moderasiya növbəsi"}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const count = tab.value ? counts[tab.value] || 0 : visibleCount;
          const active = status === tab.value;
          return (
            <button
              key={tab.value || "all"}
              type="button"
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${active ? "bg-[#0c1412] text-white" : "bg-white text-ink"}`}
              onClick={() => {
                setSelected([]);
                apply({ status: tab.value, page: "1" });
              }}
            >
              {tab.label} <span className={active ? "text-white/70" : "text-mist"}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <input className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm xl:col-span-2" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Başlıq, nömrə, satıcı və ya e-poçt" />
        <select className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={category} onChange={(event) => apply({ category: event.target.value, page: "1" })}>
          <option value="">Bütün kateqoriyalar</option>
          {categories.data?.items.map((item) => (
            <option key={item.id} value={item.slug}>{item.name}</option>
          ))}
        </select>
        <select className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={city} onChange={(event) => apply({ city: event.target.value, page: "1" })}>
          <option value="">Bütün şəhərlər</option>
          {cities.data?.items.map((item) => (
            <option key={item.id} value={item.slug}>{item.name}</option>
          ))}
        </select>
        <select className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm" value={sort} onChange={(event) => apply({ sort: event.target.value, page: "1" })}>
          <option value="new">Ən yeni</option>
          <option value="views">Ən çox baxılan</option>
          <option value="price-asc">Ən ucuz</option>
          <option value="price-desc">Ən bahalı</option>
        </select>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={featured} onChange={(event) => apply({ featured: event.target.checked ? "1" : "", page: "1" })} />
        Yalnız irəli çəkilənlər
      </label>

      {selected.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2">
          <span className="text-sm font-semibold">{selected.length} seçildi</span>
          <Small onClick={() => bulk("approve")}>Təsdiqlə</Small>
          <Small onClick={() => setRejectIds(selected)}>Rədd et</Small>
          <Small onClick={() => bulk("hide")}>Gizlət</Small>
          <Small onClick={() => bulk("restore")}>Bərpa et</Small>
          <Small onClick={() => bulk("feature")}>İrəli çək</Small>
          <Small onClick={() => bulk("unfeature")}>İrəlini sil</Small>
          <Small onClick={() => bulk("sold")}>Satıldı</Small>
          <button type="button" className="text-xs text-mist" onClick={() => setSelected([])}>Seçimi ləğv et</button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <div className="hidden grid-cols-[28px_1.6fr_0.7fr_0.8fr_0.7fr_0.5fr_88px] gap-2 border-b border-black/5 px-3 py-2 text-xs font-semibold uppercase text-mist md:grid">
          <input
            type="checkbox"
            checked={allChecked}
            aria-label="Hamısını seç"
            onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...pageIds])) : selected.filter((id) => !pageIds.includes(id)))}
          />
          <span>Elan</span>
          <span>Qiymət</span>
          <span>Yer</span>
          <span>Satıcı</span>
          <span>Baxış</span>
          <span />
        </div>
        {query.isLoading ? <p className="p-6 text-sm text-mist">Yüklənir...</p> : null}
        {!query.isLoading && !items.length ? <p className="p-6 text-sm text-mist">Bu filtrə uyğun elan yoxdur.</p> : null}
        {items.map((listing) => (
          <div key={listing.id} className="grid gap-3 border-t border-black/5 px-3 py-3 md:grid-cols-[28px_1.6fr_0.7fr_0.8fr_0.7fr_0.5fr_88px] md:items-center">
            <input
              type="checkbox"
              checked={selected.includes(listing.id)}
              aria-label="Elanı seç"
              onChange={(event) => setSelected((prev) => event.target.checked ? [...prev, listing.id] : prev.filter((id) => id !== listing.id))}
            />
            <button type="button" className="flex min-w-0 gap-3 text-left" onClick={() => setOpenId(listing.id)}>
              {listing.images?.[0]?.thumbnailUrl ? (
                <img src={listing.images[0].thumbnailUrl} alt="" className="h-14 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-[#f4f6f8] text-[10px] text-mist">Şəkil yox</span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-semibold">{listing.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-mist">
                  <span>#{listing.publicNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${tone(listing.status)}`}>{statusLabel[listing.status]}</span>
                  {listing.isFeatured ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-950">İrəli</span> : null}
                  {listing.reports ? <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">{listing.reports} şikayət</span> : null}
                </span>
                {listing.rejectionReason ? <span className="mt-1 block truncate text-xs text-red-700">{listing.rejectionReason}</span> : null}
              </span>
            </button>
            <div className="text-sm font-semibold">{formatPrice(listing.price)}</div>
            <div className="text-sm text-mist">{listing.city?.name}{listing.district ? `, ${listing.district.name}` : ""}<div>{listing.category?.name}</div></div>
            <Link to={`/admin/istifadeciler/${listing.user?.id}`} className="truncate text-sm">{listing.user?.firstName} {listing.user?.lastName}</Link>
            <div className="text-sm">{listing.viewCount}</div>
            <button type="button" className="rounded-full bg-[#f4f6f8] px-3 py-1.5 text-xs font-semibold" onClick={() => setOpenId(listing.id)}>Bax</button>
          </div>
        ))}
      </div>

      {query.data && query.data.pages > 1 ? (
        <div className="mt-3 flex items-center gap-2">
          <Small onClick={() => apply({ page: String(Math.max(1, page - 1)) })}>Əvvəlki</Small>
          <span className="text-sm">{query.data.page} / {query.data.pages}</span>
          <Small onClick={() => apply({ page: String(Math.min(query.data.pages, page + 1)) })}>Növbəti</Small>
        </div>
      ) : null}

      {openId ? (
        detail.data ? (
          <ListingDrawer
            data={detail.data}
            onClose={() => setOpenId(null)}
            onAct={act}
            onReject={() => setRejectIds([openId])}
            onDelete={() => setDeleteId(openId)}
          />
        ) : (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
            <button type="button" className="h-full flex-1" aria-label="Bağla" onClick={() => setOpenId(null)} />
            <aside className="grid h-full w-full max-w-md place-items-center bg-white text-sm text-mist">{detail.isError ? "Elan açılmadı" : "Yüklənir..."}</aside>
          </div>
        )
      ) : null}
      {rejectIds ? (
        <RejectDialog
          count={rejectIds.length}
          onClose={() => setRejectIds(null)}
          onSubmit={async (reason) => {
            if (rejectIds.length === 1) await act(rejectIds[0], "reject", { reason });
            else await bulk("reject", { reason }, rejectIds);
            setRejectIds(null);
          }}
        />
      ) : null}
      {deleteId ? (
        <ConfirmDialog
          title="Elan silinsin?"
          text="Elan saytdan yox olacaq. Jurnalda qeyd qalacaq."
          confirm="Sil"
          onClose={() => setDeleteId(null)}
          onConfirm={() => remove(deleteId)}
        />
      ) : null}
    </div>
  );
}

function ListingDrawer({
  data,
  onClose,
  onAct,
  onReject,
  onDelete,
}: {
  data: DetailResponse;
  onClose: () => void;
  onAct: (id: string, action: string) => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const listing = data.listing;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
      <button type="button" className="h-full flex-1" aria-label="Bağla" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-mist">#{listing.publicNumber}</p>
            <h2 className="text-xl font-extrabold">{listing.title}</h2>
          </div>
          <button type="button" className="text-sm text-mist" onClick={onClose}>Bağla</button>
        </div>
        {listing.images?.length ? (
          <div className="mb-4 grid grid-cols-3 gap-2">
            {listing.images.map((image) => (
              <img key={image.id || image.url} src={image.thumbnailUrl || image.url} alt="" className="h-20 w-full rounded-xl object-cover" />
            ))}
          </div>
        ) : null}
        <p className="text-lg font-bold">{formatPrice(listing.price)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone(listing.status)}`}>{statusLabel[listing.status]}</span>
          {listing.isFeatured ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">İrəli çəkilib</span> : null}
        </div>
        {listing.rejectionReason ? <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800">{listing.rejectionReason}</p> : null}
        <p className="mt-4 whitespace-pre-wrap text-sm">{listing.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Meta label="Kateqoriya" value={[listing.category?.name, listing.subcategory?.name].filter(Boolean).join(" / ")} />
          <Meta label="Yer" value={[listing.city?.name, listing.district?.name].filter(Boolean).join(", ")} />
          <Meta label="Vəziyyət" value={conditionLabel[listing.condition]} />
          <Meta label="Marka" value={listing.brand || "—"} />
          <Meta label="Telefon" value={listing.phone || "—"} />
          <Meta label="Baxış" value={String(listing.viewCount)} />
          <Meta label="Yaranıb" value={formatDate(listing.createdAt)} />
          <Meta label="Bitir" value={formatDate(listing.expiresAt)} />
          <Meta label="Favori" value={String(data.counts.favorites)} />
          <Meta label="Yazışma" value={String(data.counts.conversations)} />
          <Meta label="Təklif" value={String(data.counts.offers)} />
          <Meta label="Şikayət" value={String(data.counts.reports)} />
        </dl>
        <p className="mt-4 text-sm">
          Satıcı: <Link className="font-semibold" to={`/admin/istifadeciler/${listing.user?.id}`}>{listing.user?.firstName} {listing.user?.lastName}</Link>
        </p>
        {data.reports.length ? (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-bold">Şikayətlər</h3>
            {data.reports.map((report) => (
              <div key={report.id} className="rounded-2xl bg-[#f4f6f8] px-3 py-2 text-sm">
                <p className="font-semibold">{reportReasons.find((item) => item.value === report.reason)?.label || report.reason}</p>
                {report.details ? <p>{report.details}</p> : null}
                <p className="text-xs text-mist">{report.reporter.firstName} {report.reporter.lastName} · {formatDate(report.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Small onClick={() => onAct(listing.id, "approve")}>Təsdiqlə</Small>
          <Small onClick={onReject}>Rədd et</Small>
          <Small onClick={() => onAct(listing.id, "hide")}>Gizlət</Small>
          <Small onClick={() => onAct(listing.id, "restore")}>Bərpa</Small>
          <Small onClick={() => onAct(listing.id, "feature")}>{listing.isFeatured ? "İrəlini sil" : "İrəli çək"}</Small>
          <Small onClick={() => onAct(listing.id, "sold")}>Satıldı</Small>
          <Link to={`/elan/${listing.slug}`} className="rounded-full bg-[#f4f6f8] px-3 py-1.5 text-xs font-semibold">Saytda</Link>
          <Link to={`/elan/${listing.slug}/redakte`} className="rounded-full bg-[#f4f6f8] px-3 py-1.5 text-xs font-semibold">Redaktə</Link>
          <button type="button" className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={onDelete}>Sil</button>
        </div>
      </aside>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f4f6f8] px-3 py-2">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="font-semibold">{value || "—"}</dd>
    </div>
  );
}

function RejectDialog({ count, onClose, onSubmit }: { count: number; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) return;
    setBusy(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-5">
        <h2 className="text-lg font-extrabold">{count > 1 ? `${count} elanı rədd et` : "Elanı rədd et"}</h2>
        <p className="mt-1 text-sm text-mist">Səbəb satıcıya bildiriş kimi gedəcək.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_REASONS.map((item) => (
            <button key={item} type="button" className="rounded-full bg-[#f4f6f8] px-3 py-1 text-xs font-semibold" onClick={() => setReason(item)}>{item}</button>
          ))}
        </div>
        <textarea className="mt-3 min-h-24 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Rədd səbəbi" required minLength={3} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-full px-4 py-2 text-sm" onClick={onClose}>Ləğv</button>
          <button type="submit" className="rounded-full bg-[#0c1412] px-4 py-2 text-sm font-bold text-white" disabled={busy}>Rədd et</button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({ title, text, confirm, onClose, onConfirm }: { title: string; text: string; confirm: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="mt-2 text-sm text-mist">{text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-full px-4 py-2 text-sm" onClick={onClose}>Ləğv</button>
          <button type="button" className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white" onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
  );
}

function Small({ children, onClick }: { children: string; onClick: () => void }) {
  return <button type="button" className="rounded-full bg-[#f4f6f8] px-3 py-1.5 text-xs font-semibold" onClick={onClick}>{children}</button>;
}
