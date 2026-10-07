import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { api, uploadFile } from "../api";
import { Button, Field, FullSpinner, inputClass } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { formatPrice } from "../format";
import { categoryIcon, reportReasons, roleLabel, statusLabel } from "../labels";
import { Category, Listing, ListingStatus, Role, User } from "../types";

const nav = [
  ["/admin", "Panel"],
  ["/admin/istifadeciler", "İstifadəçilər"],
  ["/admin/elanlar", "Elanlar"],
  ["/admin/kateqoriyalar", "Kateqoriyalar"],
  ["/admin/sikayetler", "Şikayətlər"],
  ["/admin/reyler", "Rəylər"],
  ["/admin/tenzimlemeler", "Tənzimləmələr"],
];

export function AdminLayout() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="bg-brand-800 text-white">
        <Link to="/" className="block px-5 py-5 text-xl font-extrabold">ALVER idarə</Link>
        <nav className="space-y-1 px-3">
          {nav.filter(([to]) => admin || !["/admin/istifadeciler", "/admin/kateqoriyalar", "/admin/reyler", "/admin/tenzimlemeler"].includes(to)).map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"} className={({ isActive }) => `block rounded-xl px-3 py-2 text-sm ${isActive ? "bg-white/15" : "hover:bg-white/10"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="bg-paper p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}

type Stats = {
  usersTotal: number;
  usersActive: number;
  listingsTotal: number;
  listingsActive: number;
  listingsPending: number;
  listingsSold: number;
  reportsOpen: number;
  messagesTotal: number;
  listingsByDay: { date: string; count: number }[];
  usersByDay: { date: string; count: number }[];
  listingsByCategory: { name: string; count: number }[];
};

export function AdminDashboard() {
  const query = useQuery({ queryKey: ["admin-stats"], queryFn: () => api<Stats>("/api/admin/stats") });
  if (query.isLoading || !query.data) return <FullSpinner />;
  const stats = query.data;
  const cards = [
    ["Ümumi istifadəçilər", stats.usersTotal],
    ["Aktiv istifadəçilər", stats.usersActive],
    ["Ümumi elanlar", stats.listingsTotal],
    ["Aktiv elanlar", stats.listingsActive],
    ["Gözləyən elanlar", stats.listingsPending],
    ["Satılmış elanlar", stats.listingsSold],
    ["Şikayətlər", stats.reportsOpen],
    ["Mesajlar", stats.messagesTotal],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Panel</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="card p-4">
            <p className="text-sm text-mist">{label}</p>
            <p className="text-2xl font-extrabold">{value}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Elanlar (14 gün)" rows={stats.listingsByDay} />
        <Chart title="Yeni istifadəçilər" rows={stats.usersByDay} />
      </div>
      <div className="card p-4">
        <h2 className="mb-3 font-bold">Kateqoriyalara görə</h2>
        {stats.listingsByCategory.map((item) => (
          <div key={item.name} className="mb-2">
            <div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><span>{item.count}</span></div>
            <div className="h-2 rounded-full bg-brand-50"><div className="h-2 rounded-full bg-brand-700" style={{ width: `${Math.min(100, item.count * 8)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chart({ title, rows }: { title: string; rows: { date: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="card p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="flex h-40 items-end gap-1">
        {rows.map((row) => (
          <div key={row.date} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t bg-brand-700" style={{ height: `${(row.count / max) * 100}%` }} title={`${row.date}: ${row.count}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const query = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: () => api<{ items: (User & { _count?: { listings: number } })[] }>(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">İstifadəçilər</h1>
      <div className="flex gap-2">
        <input className={inputClass} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ad, e-poçt və ya telefon" />
        <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">Bütün rollar</option>
          {Object.entries(roleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {query.data?.items.map((user) => (
          <Link key={user.id} to={`/admin/istifadeciler/${user.id}`} className="card flex items-center justify-between p-3 text-sm">
            <span>{user.firstName} {user.lastName}<br /><span className="text-mist">{user.email}</span></span>
            <span>{roleLabel[user.role || "USER"]}{user.isBlocked ? " · blok" : ""}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const { user: me } = useAuth();
  const { push } = useToast();
  const query = useQuery({ queryKey: ["admin-user", id], queryFn: () => api<{ user: User & { listings: Listing[] } }>(`/api/admin/users/${id}`) });
  if (query.isLoading || !query.data) return <FullSpinner />;
  const user = query.data.user;
  async function save(body: { role?: Role; isBlocked?: boolean }) {
    try {
      const data = await api<{ message: string }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      push(data.message);
      query.refetch();
    } catch (error) {
      push(error instanceof Error ? error.message : "Yenilənmədi");
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{user.firstName} {user.lastName}</h1>
      <div className="card space-y-2 p-4 text-sm">
        <p>{user.email}</p>
        <p>{user.phone}</p>
        <p>{user.bio}</p>
        <p>{roleLabel[user.role || "USER"]} · {user.isBlocked ? "bloklanıb" : "aktiv"}</p>
        <div className="flex flex-wrap gap-2">
          <select className={inputClass} defaultValue={user.role} onChange={(event) => save({ role: event.target.value as Role })}>
            {Object.entries(roleLabel).filter(([value]) => me?.role === "SUPER_ADMIN" || (value !== "SUPER_ADMIN" && value !== "ADMIN") || value === user.role).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Button type="button" variant="ghost" onClick={() => save({ isBlocked: !user.isBlocked })}>{user.isBlocked ? "Blokdan çıxar" : "Blokla"}</Button>
          {me?.role === "SUPER_ADMIN" ? <Button type="button" variant="danger" onClick={async () => {
            if (!confirm("İstifadəçi silinsin?")) return;
            await api(`/api/admin/users/${id}`, { method: "DELETE" });
            push("İstifadəçi silindi");
          }}>Sil</Button> : null}
        </div>
      </div>
      <h2 className="font-bold">Elanları</h2>
      {user.listings?.map((listing) => (
        <Link key={listing.id} to={`/elan/${listing.slug}`} className="card block p-3 text-sm">{listing.title} · {formatPrice(listing.price)} · {statusLabel[listing.status]}</Link>
      ))}
    </div>
  );
}

export function AdminListingsPage() {
  const [status, setStatus] = useState("PENDING");
  const [q, setQ] = useState("");
  const { push } = useToast();
  const query = useQuery({
    queryKey: ["admin-listings", status, q],
    queryFn: () => api<{ items: Listing[] }>(`/api/admin/listings?status=${status}&q=${encodeURIComponent(q)}`),
  });
  async function act(id: string, action: string, body?: unknown) {
    try {
      const data = await api<{ message: string }>(`/api/admin/listings/${id}/${action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      push(data.message);
      query.refetch();
    } catch (error) {
      push(error instanceof Error ? error.message : "Əməliyyat alınmadı");
    }
  }
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold">Elanlar</h1>
      <div className="flex gap-2">
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
          {(["PENDING", "ACTIVE", "REJECTED", "HIDDEN", "SOLD", "EXPIRED"] as ListingStatus[]).map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
        </select>
        <input className={inputClass} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Axtar" />
      </div>
      {query.data?.items.map((listing) => (
        <article key={listing.id} className="card space-y-2 p-3">
          <div className="flex gap-3">
            <img src={listing.images?.[0]?.thumbnailUrl} alt="" className="h-16 w-20 rounded-xl object-cover" />
            <div>
              <Link to={`/elan/${listing.slug}`} className="font-semibold">{listing.title}</Link>
              <p className="text-sm text-mist">{formatPrice(listing.price)} · {listing.user?.firstName} {listing.user?.lastName} · {statusLabel[listing.status]}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => act(listing.id, "approve")}>Təsdiqlə</Button>
            <Button type="button" variant="ghost" onClick={() => {
              const reason = prompt("Rədd səbəbi");
              if (reason) void act(listing.id, "reject", { reason });
            }}>Rədd et</Button>
            <Button type="button" variant="ghost" onClick={() => act(listing.id, "hide")}>Gizlət</Button>
            <Button type="button" variant="ghost" onClick={() => act(listing.id, "restore")}>Bərpa et</Button>
            <Button type="button" variant="ghost" onClick={() => act(listing.id, "feature")}>İrəli çək</Button>
            <Button type="button" variant="ghost" onClick={() => act(listing.id, "sold")}>Satıldı</Button>
            <Link to={`/elan/${listing.slug}/redakte`} className="rounded-full bg-paper px-3 py-2 text-sm font-semibold">Redaktə</Link>
            <Button type="button" variant="danger" onClick={async () => { await api(`/api/admin/listings/${listing.id}`, { method: "DELETE" }); query.refetch(); }}>Sil</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AdminCategoriesPage() {
  const { push } = useToast();
  const query = useQuery({ queryKey: ["admin-categories"], queryFn: () => api<{ items: Category[] }>("/api/admin/categories") });
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [icon, setIcon] = useState("LayoutGrid");

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/admin/categories", { method: "POST", body: JSON.stringify({ name, parentId: parentId || null, icon, sortOrder: 0, isActive: true }) });
      setName("");
      query.refetch();
    } catch (error) {
      push(error instanceof Error ? error.message : "Yaradılmadı");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Kateqoriyalar</h1>
      <form onSubmit={create} className="card grid gap-2 p-4 md:grid-cols-4">
        <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ad" required />
        <select className={inputClass} value={parentId} onChange={(event) => setParentId(event.target.value)}>
          <option value="">Əsas kateqoriya</option>
          {query.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className={inputClass} value={icon} onChange={(event) => setIcon(event.target.value)}>
          {["Smartphone", "Tv", "Car", "Home", "Sofa", "Shirt", "Laptop", "Baby", "Dumbbell", "Wrench", "LayoutGrid"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <Button type="submit">Əlavə et</Button>
      </form>
      {query.data?.items.map((category) => {
        const Icon = categoryIcon(category.icon);
        return (
          <div key={category.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold"><Icon size={18} /> {category.name}</div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={async () => {
                  await api(`/api/admin/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ isActive: category.isActive === false }) });
                  query.refetch();
                }}>{category.isActive === false ? "Aktiv et" : "Deaktiv et"}</Button>
                <Button type="button" variant="danger" onClick={async () => {
                  try {
                    await api(`/api/admin/categories/${category.id}`, { method: "DELETE" });
                    query.refetch();
                  } catch (error) {
                    push(error instanceof Error ? error.message : "Silinmədi");
                  }
                }}>Sil</Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {category.children?.map((child) => (
                <span key={child.id} className="rounded-full bg-paper px-3 py-1 text-sm">{child.name}
                  <button type="button" className="ml-2" onClick={async () => {
                    try {
                      await api(`/api/admin/categories/${child.id}`, { method: "DELETE" });
                      query.refetch();
                    } catch (error) {
                      push(error instanceof Error ? error.message : "Silinmədi");
                    }
                  }}>×</button>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminReportsPage() {
  const { push } = useToast();
  const query = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => api<{ items: { id: string; reason: string; details?: string | null; status: string; listing: { title: string; slug: string }; reporter: { firstName: string; lastName: string } }[] }>("/api/admin/reports"),
  });
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold">Şikayətlər</h1>
      {query.data?.items.map((report) => (
        <article key={report.id} className="card space-y-2 p-4 text-sm">
          <Link to={`/elan/${report.listing.slug}`} className="font-semibold">{report.listing.title}</Link>
          <p>{reportReasons.find((item) => item.value === report.reason)?.label || report.reason} · {report.status}</p>
          <p>{report.details}</p>
          <p className="text-mist">{report.reporter.firstName} {report.reporter.lastName}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={async () => {
              const adminNote = prompt("Nəticə qeydi") || "Şikayət həll edildi";
              await api(`/api/admin/reports/${report.id}`, { method: "PATCH", body: JSON.stringify({ status: "RESOLVED", adminNote }) });
              push("Şikayət bağlandı");
              query.refetch();
            }}>Həll et</Button>
            <Button type="button" variant="ghost" onClick={async () => {
              await api(`/api/admin/reports/${report.id}`, { method: "PATCH", body: JSON.stringify({ status: "DISMISSED", adminNote: "Şikayət əsassızdır" }) });
              query.refetch();
            }}>Rədd et</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AdminReviewsPage() {
  const query = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => api<{ items: { id: string; rating: number; comment?: string | null; reviewer: { firstName: string; lastName: string }; reviewee: { firstName: string; lastName: string }; listing: { title: string } }[] }>("/api/admin/reviews"),
  });
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold">Rəylər</h1>
      {query.data?.items.map((review) => (
        <article key={review.id} className="card flex items-center justify-between p-4 text-sm">
          <div>
            <p className="font-semibold">{review.reviewer.firstName} → {review.reviewee.firstName} · {review.rating}/5</p>
            <p>{review.listing.title}</p>
            <p>{review.comment}</p>
          </div>
          <Button type="button" variant="danger" onClick={async () => { await api(`/api/admin/reviews/${review.id}`, { method: "DELETE" }); query.refetch(); }}>Sil</Button>
        </article>
      ))}
    </div>
  );
}

export function AdminSettingsPage() {
  const { push } = useToast();
  const { reload } = useSettings();
  const query = useQuery({ queryKey: ["admin-settings"], queryFn: () => api<Record<string, string>>("/api/admin/settings") });
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const data = form || query.data;
  if (!data) return <FullSpinner />;

  function set(key: string, value: string) {
    setForm({ ...(form || query.data || {}), [key]: value });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const body = form || query.data;
    try {
      await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
      push("Tənzimləmələr yadda saxlandı");
      reload();
      query.refetch();
    } catch (error) {
      push(error instanceof Error ? error.message : "Saxlanmadı");
    }
  }

  const fields: [string, string][] = [
    ["siteName", "Sayt adı"],
    ["phone", "Telefon"],
    ["email", "E-poçt"],
    ["whatsapp", "WhatsApp"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["tiktok", "TikTok"],
    ["seoTitle", "SEO başlıq"],
    ["seoDescription", "SEO açıqlama"],
  ];

  return (
    <form onSubmit={save} className="card max-w-2xl space-y-3 p-5">
      <h1 className="text-2xl font-extrabold">Tənzimləmələr</h1>
      {fields.map(([key, label]) => (
        <Field key={key} label={label}>
          {key === "seoDescription" ? (
            <textarea className={inputClass} rows={3} value={data[key] || ""} onChange={(event) => set(key, event.target.value)} />
          ) : (
            <input className={inputClass} value={data[key] || ""} onChange={(event) => set(key, event.target.value)} />
          )}
        </Field>
      ))}
      <label className="block text-sm">Logo
        <input className="mt-2 block" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const uploaded = await uploadFile("/api/uploads/image", file);
          set("logoUrl", uploaded.url);
        }} />
      </label>
      <label className="block text-sm">Favicon
        <input className="mt-2 block" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const uploaded = await uploadFile("/api/uploads/image", file);
          set("faviconUrl", uploaded.url);
        }} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={data.autoApproveListings === "true"} onChange={(event) => set("autoApproveListings", event.target.checked ? "true" : "false")} />
        Elanlar avtomatik təsdiqlənsin
      </label>
      <Button type="submit">Yadda saxla</Button>
    </form>
  );
}
