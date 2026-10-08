import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Flag,
  FolderTree,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Star,
  Tags,
  Users,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { api, uploadFile } from "../api";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { formatDate, formatPrice } from "../format";
import { categoryIcon, reportReasons, roleLabel, statusLabel } from "../labels";
import { Category, Listing, ListingStatus, Role, User } from "../types";

const actionLabel: Record<string, string> = {
  USER_UPDATE: "İstifadəçi yeniləndi",
  USER_DELETE: "İstifadəçi silindi",
  LISTING_APPROVE: "Elan təsdiqləndi",
  LISTING_REJECT: "Elan rədd edildi",
  LISTING_HIDE: "Elan gizlədildi",
  LISTING_RESTORE: "Elan bərpa edildi",
  LISTING_FEATURE: "Elan irəli çəkildi",
  LISTING_SOLD: "Elan satıldı",
  LISTING_DELETE: "Elan silindi",
  LISTING_BULK: "Toplu elan əməliyyatı",
  CATEGORY_CREATE: "Kateqoriya yaradıldı",
  CATEGORY_UPDATE: "Kateqoriya yeniləndi",
  CATEGORY_DELETE: "Kateqoriya silindi",
  REPORT_UPDATE: "Şikayət yeniləndi",
  REVIEW_DELETE: "Rəy silindi",
  SETTINGS_UPDATE: "Tənzimləmə dəyişdi",
  CITY_CREATE: "Şəhər əlavə edildi",
  CITY_UPDATE: "Şəhər yeniləndi",
  CITY_DELETE: "Şəhər silindi",
  DISTRICT_CREATE: "Rayon əlavə edildi",
  DISTRICT_DELETE: "Rayon silindi",
};

function isAdmin(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const badges = useQuery({
    queryKey: ["admin-badges"],
    queryFn: () => api<{ pending: number; reports: number }>("/api/admin/badges"),
  });
  const admin = isAdmin(user?.role);
  const links = [
    { to: "/admin", label: "Panel", icon: LayoutDashboard, end: true },
    ...(admin ? [{ to: "/admin/istifadeciler", label: "İstifadəçilər", icon: Users, end: false }] : []),
    { to: "/admin/elanlar", label: "Elanlar", icon: Tags, end: false, badge: badges.data?.pending },
    ...(admin ? [{ to: "/admin/kateqoriyalar", label: "Kateqoriyalar", icon: FolderTree, end: false }] : []),
    ...(admin ? [{ to: "/admin/seherler", label: "Şəhərlər", icon: MapPinned, end: false }] : []),
    ...(admin ? [{ to: "/admin/bannerler", label: "Bannerlər", icon: ImageIcon, end: false }] : []),
    { to: "/admin/sikayetler", label: "Şikayətlər", icon: Flag, end: false, badge: badges.data?.reports },
    ...(admin ? [{ to: "/admin/reyler", label: "Rəylər", icon: Star, end: false }] : []),
    { to: "/admin/yazismalar", label: "Yazışmalar", icon: MessageSquare, end: false },
    { to: "/admin/teklifler", label: "Təkliflər", icon: Tags, end: false },
    { to: "/admin/jurnal", label: "Jurnal", icon: ClipboardList, end: false },
    ...(user?.role === "SUPER_ADMIN" ? [{ to: "/admin/tenzimlemeler", label: "Tənzimləmələr", icon: Settings, end: false }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#eef1f4] text-ink">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0c1412] text-white transition md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link to="/admin" className="text-lg font-extrabold" onClick={() => setOpen(false)}>ALVER idarə</Link>
          <button className="md:hidden" type="button" onClick={() => setOpen(false)} aria-label="Bağla"><X size={18} /></button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-6">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? "bg-white text-[#0c1412]" : "text-white/80 hover:bg-white/10"}`}
            >
              <item.icon size={16} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span className="rounded-full bg-amber-400 px-2 text-xs font-bold text-ink">{item.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open ? <button className="fixed inset-0 z-30 bg-black/40 md:hidden" type="button" aria-label="Menyunu bağla" onClick={() => setOpen(false)} /> : null}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-white px-4">
          <button className="md:hidden" type="button" onClick={() => setOpen(true)} aria-label="Menyu"><Menu /></button>
          <form
            className="relative hidden max-w-md flex-1 sm:block"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/admin/elanlar?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" size={16} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Elan axtar..." className="w-full rounded-full border border-black/10 bg-[#f4f6f8] py-2 pl-9 pr-3 text-sm outline-none" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <a href="/" className="text-sm font-semibold text-mist">Sayta bax</a>
            <div className="text-right text-sm">
              <div className="font-semibold">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-mist">{roleLabel[user?.role || "USER"]}</div>
            </div>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#f4f6f8]"
              aria-label="Çıxış"
              onClick={async () => {
                await logout();
                navigate("/admin/giris");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}

function PageTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {text ? <p className="text-sm text-mist">{text}</p> : null}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" }) {
  const color = { slate: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-900", red: "bg-red-50 text-red-700" }[tone];
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{children}</span>;
}

function statusTone(status: string): "slate" | "green" | "amber" | "red" {
  if (status === "ACTIVE" || status === "RESOLVED" || status === "ACCEPTED") return "green";
  if (status === "PENDING" || status === "OPEN" || status === "REVIEWING") return "amber";
  if (status === "REJECTED" || status === "DISMISSED") return "red";
  return "slate";
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!isAdmin(user?.role)) return <p className="rounded-2xl bg-white p-6 text-sm">Bu bölmə yalnız admin üçündür.</p>;
  return children;
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
  recentAudit: { id: string; action: string; createdAt: string; actor?: { firstName: string; lastName: string } | null }[];
  latestListings: { id: string; title: string; slug: string; status: ListingStatus; price: number; createdAt: string }[];
  latestReports: { id: string; reason: string; status: string; listing: { title: string; slug: string } }[];
  latestPeople: { id: string; firstName: string; lastName: string; email: string; role: string; createdAt: string }[];
};

export function AdminDashboard() {
  const query = useQuery({ queryKey: ["admin-stats"], queryFn: () => api<Stats>("/api/admin/stats") });
  if (query.isLoading || !query.data) return <p>Yüklənir...</p>;
  const stats = query.data;
  const cards = [
    ["İstifadəçilər", stats.usersTotal],
    ["Aktiv istifadəçilər", stats.usersActive],
    ["Elanlar", stats.listingsTotal],
    ["Aktiv elanlar", stats.listingsActive],
    ["Gözləyən", stats.listingsPending],
    ["Satılmış", stats.listingsSold],
    ["Açıq şikayət", stats.reportsOpen],
    ["Mesajlar", stats.messagesTotal],
  ];
  return (
    <div className="space-y-6">
      <PageTitle title="Panel" text="Bu gün platformada nə baş verir." />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-black/5 bg-white p-4">
            <p className="text-sm text-mist">{label}</p>
            <p className="mt-2 text-3xl font-extrabold">{value}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Yeni elanlar, 14 gün" rows={stats.listingsByDay} />
        <Chart title="Yeni istifadəçilər, 14 gün" rows={stats.usersByDay} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Son elanlar">
          {stats.latestListings.map((item) => (
            <Link key={item.id} to={`/elan/${item.slug}`} className="flex items-center justify-between gap-3 border-t border-black/5 py-2 text-sm first:border-0">
              <span className="truncate">{item.title}</span>
              <Pill tone={statusTone(item.status)}>{statusLabel[item.status]}</Pill>
            </Link>
          ))}
        </Panel>
        <Panel title="Son şikayətlər">
          {stats.latestReports.map((item) => (
            <Link key={item.id} to={`/admin/sikayetler`} className="block border-t border-black/5 py-2 text-sm first:border-0">
              <span className="font-medium">{item.listing.title}</span>
              <span className="mt-1 block text-mist">{reportReasons.find((reason) => reason.value === item.reason)?.label}</span>
            </Link>
          ))}
        </Panel>
        <Panel title="Son istifadəçilər">
          {stats.latestPeople.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-t border-black/5 py-2 text-sm first:border-0">
              <span>{item.firstName} {item.lastName}</span>
              <span className="text-mist">{roleLabel[item.role]}</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Son əməliyyatlar">
        {stats.recentAudit.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 border-t border-black/5 py-2 text-sm first:border-0">
            <span>{actionLabel[item.action] || item.action}</span>
            <span className="text-mist">{item.actor ? `${item.actor.firstName} ${item.actor.lastName}` : "Sistem"} · {formatDate(item.createdAt)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Chart({ title, rows }: { title: string; rows: { date: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4">
      <h2 className="mb-4 font-bold">{title}</h2>
      <div className="flex h-36 items-end gap-1">
        {rows.map((row) => (
          <div key={row.date} className="flex-1 rounded-t bg-[#0c1412]" style={{ height: `${Math.max(4, (row.count / max) * 100)}%` }} title={`${row.date}: ${row.count}`} />
        ))}
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const query = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: () => api<{ items: (User & { emailVerified?: boolean; phoneVerified?: boolean; _count?: { listings: number } })[] }>(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`),
  });
  return (
    <AdminOnly>
      <PageTitle title="İstifadəçilər" text="Axtar, rolunu dəyiş, blokla." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className="rounded-2xl border border-black/10 px-3 py-2 text-sm" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ad, e-poçt və ya telefon" />
        <select className="rounded-2xl border border-black/10 px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">Bütün rollar</option>
          {Object.entries(roleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-mist"><tr><th className="px-4 py-3">İstifadəçi</th><th>Rol</th><th>Təsdiq</th><th>Elan</th><th>Vəziyyət</th></tr></thead>
          <tbody>
            {query.data?.items.map((person) => (
              <tr key={person.id} className="border-t border-black/5">
                <td className="px-4 py-3">
                  <Link className="font-semibold" to={`/admin/istifadeciler/${person.id}`}>{person.firstName} {person.lastName}</Link>
                  <div className="text-mist">{person.email}</div>
                </td>
                <td>{roleLabel[person.role || "USER"]}</td>
                <td>{person.emailVerified ? "e-poçt" : "—"} / {person.phoneVerified ? "telefon" : "—"}</td>
                <td>{person._count?.listings ?? 0}</td>
                <td>{person.isBlocked ? <Pill tone="red">Blok</Pill> : <Pill tone="green">Aktiv</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminOnly>
  );
}

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const { user: me } = useAuth();
  const { push } = useToast();
  const query = useQuery({ queryKey: ["admin-user", id], queryFn: () => api<{ user: User & { listings: Listing[]; emailVerified: boolean; phoneVerified: boolean } }>(`/api/admin/users/${id}`) });
  if (!isAdmin(me?.role)) return <AdminOnly><span /></AdminOnly>;
  if (query.isLoading || !query.data) return <p>Yüklənir...</p>;
  const person = query.data.user;
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
      <PageTitle title={`${person.firstName} ${person.lastName}`} text={person.email} />
      <section className="rounded-2xl border border-black/5 bg-white p-4 text-sm">
        <p>{person.phone}</p>
        <p className="text-mist">{person.bio}</p>
        <p className="mt-2">E-poçt: {person.emailVerified ? "təsdiqli" : "təsdiqsiz"} · Telefon: {person.phoneVerified ? "təsdiqli" : "təsdiqsiz"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="rounded-full border px-3 py-2" defaultValue={person.role} onChange={(event) => save({ role: event.target.value as Role })}>
            {Object.entries(roleLabel).filter(([value]) => me?.role === "SUPER_ADMIN" || !["ADMIN", "SUPER_ADMIN"].includes(value) || value === person.role).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="rounded-full bg-[#f4f6f8] px-4 py-2 font-semibold" type="button" onClick={() => save({ isBlocked: !person.isBlocked })}>{person.isBlocked ? "Blokdan çıxar" : "Blokla"}</button>
          {me?.role === "SUPER_ADMIN" ? (
            <button className="rounded-full bg-red-600 px-4 py-2 font-semibold text-white" type="button" onClick={async () => {
              if (!confirm("İstifadəçi silinsin?")) return;
              await api(`/api/admin/users/${id}`, { method: "DELETE" });
              push("İstifadəçi silindi");
            }}>Sil</button>
          ) : null}
        </div>
      </section>
      <h2 className="font-bold">Elanları</h2>
      <div className="space-y-2">
        {person.listings?.map((listing) => (
          <Link key={listing.id} to={`/elan/${listing.slug}`} className="block rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm">
            {listing.title} · {formatPrice(listing.price)} · {statusLabel[listing.status]}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Mini({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="rounded-full bg-[#f4f6f8] px-3 py-1.5 text-xs font-semibold" type="button" onClick={onClick}>{children}</button>;
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
    <AdminOnly>
      <PageTitle title="Kateqoriyalar" />
      <form onSubmit={create} className="mb-4 grid gap-2 rounded-2xl border border-black/5 bg-white p-4 md:grid-cols-4">
        <input className="rounded-2xl border px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ad" required />
        <select className="rounded-2xl border px-3 py-2 text-sm" value={parentId} onChange={(event) => setParentId(event.target.value)}>
          <option value="">Əsas kateqoriya</option>
          {query.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="rounded-2xl border px-3 py-2 text-sm" value={icon} onChange={(event) => setIcon(event.target.value)}>
          {["Smartphone", "Tv", "Car", "Home", "Sofa", "Shirt", "Laptop", "Baby", "Dumbbell", "Wrench", "LayoutGrid"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="rounded-full bg-[#0c1412] text-sm font-bold text-white" type="submit">Əlavə et</button>
      </form>
      <div className="space-y-3">
        {query.data?.items.map((category) => {
          const Icon = categoryIcon(category.icon);
          return (
            <article key={category.id} className="rounded-2xl border border-black/5 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold"><Icon size={18} /> {category.name}</div>
                <div className="flex gap-2">
                  <Mini onClick={async () => { await api(`/api/admin/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ isActive: category.isActive === false }) }); query.refetch(); }}>{category.isActive === false ? "Aktiv et" : "Deaktiv et"}</Mini>
                  <button className="text-sm text-red-600" type="button" onClick={async () => {
                    try { await api(`/api/admin/categories/${category.id}`, { method: "DELETE" }); query.refetch(); } catch (error) { push(error instanceof Error ? error.message : "Silinmədi"); }
                  }}>Sil</button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {category.children?.map((child) => (
                  <span key={child.id} className="rounded-full bg-[#f4f6f8] px-3 py-1 text-sm">{child.name}
                    <button className="ml-2" type="button" onClick={async () => {
                      try { await api(`/api/admin/categories/${child.id}`, { method: "DELETE" }); query.refetch(); } catch (error) { push(error instanceof Error ? error.message : "Silinmədi"); }
                    }}>×</button>
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </AdminOnly>
  );
}

type CityRow = { id: string; name: string; slug: string; districts: { id: string; name: string }[]; _count: { listings: number } };

export function AdminCitiesPage() {
  const { push } = useToast();
  const query = useQuery({ queryKey: ["admin-cities"], queryFn: () => api<{ items: CityRow[] }>("/api/admin/cities") });
  const [name, setName] = useState("");
  const [districtName, setDistrictName] = useState<Record<string, string>>({});
  return (
    <AdminOnly>
      <PageTitle title="Şəhərlər və rayonlar" />
      <form className="mb-4 flex gap-2" onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api("/api/admin/cities", { method: "POST", body: JSON.stringify({ name }) });
          setName("");
          query.refetch();
        } catch (error) {
          push(error instanceof Error ? error.message : "Əlavə olunmadı");
        }
      }}>
        <input className="rounded-2xl border px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Yeni şəhər" required />
        <button className="rounded-full bg-[#0c1412] px-4 text-sm font-bold text-white" type="submit">Əlavə et</button>
      </form>
      <div className="space-y-3">
        {query.data?.items.map((city) => (
          <article key={city.id} className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{city.name} <span className="text-sm font-normal text-mist">{city._count.listings} elan</span></h2>
              <button className="text-sm text-red-600" type="button" onClick={async () => {
                try { await api(`/api/admin/cities/${city.id}`, { method: "DELETE" }); query.refetch(); } catch (error) { push(error instanceof Error ? error.message : "Silinmədi"); }
              }}>Şəhəri sil</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {city.districts.map((district) => (
                <span key={district.id} className="rounded-full bg-[#f4f6f8] px-3 py-1 text-sm">{district.name}
                  <button className="ml-2" type="button" onClick={async () => {
                    try { await api(`/api/admin/districts/${district.id}`, { method: "DELETE" }); query.refetch(); } catch (error) { push(error instanceof Error ? error.message : "Silinmədi"); }
                  }}>×</button>
                </span>
              ))}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={async (event) => {
              event.preventDefault();
              try {
                await api(`/api/admin/cities/${city.id}/districts`, { method: "POST", body: JSON.stringify({ name: districtName[city.id] || "" }) });
                setDistrictName((prev) => ({ ...prev, [city.id]: "" }));
                query.refetch();
              } catch (error) {
                push(error instanceof Error ? error.message : "Rayon əlavə olunmadı");
              }
            }}>
              <input className="rounded-full border px-3 py-1.5 text-sm" value={districtName[city.id] || ""} onChange={(event) => setDistrictName((prev) => ({ ...prev, [city.id]: event.target.value }))} placeholder="Rayon" />
              <button className="text-sm font-semibold" type="submit">Əlavə et</button>
            </form>
          </article>
        ))}
      </div>
    </AdminOnly>
  );
}

export function AdminBannersPage() {
  const { push } = useToast();
  const query = useQuery({ queryKey: ["admin-banners"], queryFn: () => api<{ items: { id: string; title: string; imageUrl: string; link?: string | null; isActive: boolean }[] }>("/api/admin/banners") });
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  return (
    <AdminOnly>
      <PageTitle title="Bannerlər" text="Ana səhifədə görünən şəkillər." />
      <form className="mb-4 space-y-2 rounded-2xl border border-black/5 bg-white p-4" onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api("/api/admin/banners", { method: "POST", body: JSON.stringify({ title, imageUrl, link: link || null, isActive: true, sortOrder: 0 }) });
          setTitle(""); setLink(""); setImageUrl("");
          query.refetch();
        } catch (error) {
          push(error instanceof Error ? error.message : "Əlavə olunmadı");
        }
      }}>
        <input className="w-full rounded-2xl border px-3 py-2 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Başlıq" required />
        <input className="w-full rounded-2xl border px-3 py-2 text-sm" value={link} onChange={(event) => setLink(event.target.value)} placeholder="Keçid (istəyə bağlı)" />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const uploaded = await uploadFile("/api/uploads/image", file);
          setImageUrl(uploaded.url);
        }} />
        {imageUrl ? <img src={imageUrl} alt="" className="h-24 rounded-xl object-cover" /> : null}
        <button className="rounded-full bg-[#0c1412] px-4 py-2 text-sm font-bold text-white" type="submit" disabled={!imageUrl}>Banner əlavə et</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {query.data?.items.map((banner) => (
          <article key={banner.id} className="overflow-hidden rounded-2xl border border-black/5 bg-white">
            <img src={banner.imageUrl} alt="" className="h-36 w-full object-cover" />
            <div className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-semibold">{banner.title}</div>
                <Pill tone={banner.isActive ? "green" : "slate"}>{banner.isActive ? "Aktiv" : "Gizli"}</Pill>
              </div>
              <div className="flex gap-2">
                <Mini onClick={async () => { await api(`/api/admin/banners/${banner.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !banner.isActive }) }); query.refetch(); }}>{banner.isActive ? "Gizlət" : "Göstər"}</Mini>
                <button className="text-red-600" type="button" onClick={async () => { await api(`/api/admin/banners/${banner.id}`, { method: "DELETE" }); query.refetch(); }}>Sil</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminOnly>
  );
}

export function AdminReportsPage() {
  const { push } = useToast();
  const query = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => api<{ items: { id: string; reason: string; details?: string | null; status: string; listing: { title: string; slug: string }; reporter: { firstName: string; lastName: string } }[] }>("/api/admin/reports"),
  });
  return (
    <div>
      <PageTitle title="Şikayətlər" />
      <div className="space-y-3">
        {query.data?.items.map((report) => (
          <article key={report.id} className="rounded-2xl border border-black/5 bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/elan/${report.listing.slug}`} className="font-semibold">{report.listing.title}</Link>
              <Pill tone={statusTone(report.status)}>{report.status}</Pill>
            </div>
            <p className="mt-1">{reportReasons.find((item) => item.value === report.reason)?.label}</p>
            <p className="text-mist">{report.details}</p>
            <p className="mt-1 text-mist">{report.reporter.firstName} {report.reporter.lastName}</p>
            <div className="mt-3 flex gap-2">
              <Mini onClick={async () => {
                const adminNote = prompt("Nəticə qeydi") || "Şikayət həll edildi";
                await api(`/api/admin/reports/${report.id}`, { method: "PATCH", body: JSON.stringify({ status: "RESOLVED", adminNote }) });
                push("Şikayət bağlandı");
                query.refetch();
              }}>Həll et</Mini>
              <Mini onClick={async () => {
                await api(`/api/admin/reports/${report.id}`, { method: "PATCH", body: JSON.stringify({ status: "DISMISSED", adminNote: "Şikayət əsassızdır" }) });
                query.refetch();
              }}>Rədd et</Mini>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminReviewsPage() {
  const query = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => api<{ items: { id: string; rating: number; comment?: string | null; reviewer: { firstName: string; lastName: string }; reviewee: { firstName: string; lastName: string }; listing: { title: string } }[] }>("/api/admin/reviews"),
  });
  return (
    <AdminOnly>
      <PageTitle title="Rəylər" />
      <div className="space-y-2">
        {query.data?.items.map((review) => (
          <article key={review.id} className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-4 text-sm">
            <div>
              <p className="font-semibold">{review.reviewer.firstName} → {review.reviewee.firstName} · {review.rating}/5</p>
              <p>{review.listing.title}</p>
              <p className="text-mist">{review.comment}</p>
            </div>
            <button className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white" type="button" onClick={async () => { await api(`/api/admin/reviews/${review.id}`, { method: "DELETE" }); query.refetch(); }}>Sil</button>
          </article>
        ))}
      </div>
    </AdminOnly>
  );
}

type ConversationRow = {
  id: string;
  lastMessageAt: string;
  listing: { title: string; slug: string; price: number };
  buyer: { firstName: string; lastName: string };
  seller: { firstName: string; lastName: string };
  messages: { body?: string | null }[];
  _count: { messages: number };
};

export function AdminConversationsPage() {
  const { id } = useParams();
  const list = useQuery({ queryKey: ["admin-chats"], queryFn: () => api<{ items: ConversationRow[] }>("/api/admin/conversations") });
  const detail = useQuery({
    queryKey: ["admin-chat", id],
    enabled: Boolean(id),
    queryFn: () => api<{ conversation: { listing: { title: string; slug: string }; buyer: { firstName: string; lastName: string }; seller: { firstName: string; lastName: string }; messages: { id: string; body?: string | null; imageUrl?: string | null; createdAt: string; sender: { firstName: string; lastName: string } }[] } }>(`/api/admin/conversations/${id}`),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div>
        <PageTitle title="Yazışmalar" text="Yalnız baxış. Mesaj göndərilmir." />
        <div className="space-y-2">
          {list.data?.items.map((item) => (
            <Link key={item.id} to={`/admin/yazismalar/${item.id}`} className={`block rounded-2xl border bg-white p-3 text-sm ${item.id === id ? "border-[#0c1412]" : "border-black/5"}`}>
              <div className="font-semibold">{item.listing.title}</div>
              <div className="text-mist">{item.buyer.firstName} → {item.seller.firstName} · {item._count.messages} mesaj</div>
              <div className="truncate">{item.messages[0]?.body || "Şəkil və ya boş mesaj"}</div>
            </Link>
          ))}
        </div>
      </div>
      <section className="rounded-2xl border border-black/5 bg-white p-4">
        {!id ? <p className="text-sm text-mist">Yazışma seçin.</p> : null}
        {detail.data ? (
          <div className="space-y-3">
            <Link className="font-bold" to={`/elan/${detail.data.conversation.listing.slug}`}>{detail.data.conversation.listing.title}</Link>
            <p className="text-sm text-mist">{detail.data.conversation.buyer.firstName} və {detail.data.conversation.seller.firstName}</p>
            {detail.data.conversation.messages.map((message) => (
              <article key={message.id} className="rounded-2xl bg-[#f4f6f8] px-3 py-2 text-sm">
                <div className="text-xs font-semibold">{message.sender.firstName} {message.sender.lastName}</div>
                {message.imageUrl ? <img src={message.imageUrl} alt="" className="mt-2 max-h-40 rounded-xl" /> : null}
                <p>{message.body}</p>
                <p className="text-xs text-mist">{formatDate(message.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function AdminOffersPage() {
  const query = useQuery({
    queryKey: ["admin-offers"],
    queryFn: () => api<{ items: { id: string; amount: number; status: string; message?: string | null; createdAt: string; listing: { title: string; slug: string; price: number }; buyer: { firstName: string; lastName: string } }[] }>("/api/admin/offers"),
  });
  return (
    <div>
      <PageTitle title="Təkliflər" text="Alıcıların qiymət təklifləri. Yalnız baxış." />
      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-mist"><tr><th className="px-4 py-3">Elan</th><th>Alıcı</th><th>Təklif</th><th>Status</th><th>Tarix</th></tr></thead>
          <tbody>
            {query.data?.items.map((offer) => (
              <tr key={offer.id} className="border-t border-black/5">
                <td className="px-4 py-3"><Link to={`/elan/${offer.listing.slug}`}>{offer.listing.title}</Link><div className="text-mist">Elan: {formatPrice(offer.listing.price)}</div></td>
                <td>{offer.buyer.firstName} {offer.buyer.lastName}</td>
                <td>{formatPrice(offer.amount)}<div className="text-mist">{offer.message}</div></td>
                <td><Pill tone={statusTone(offer.status)}>{{ PENDING: "Gözləyir", ACCEPTED: "Qəbul edilib", REJECTED: "Rədd edilib" }[offer.status] || offer.status}</Pill></td>
                <td>{formatDate(offer.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminAuditPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-audit", q, page],
    queryFn: () => api<{ items: { id: string; action: string; entity: string; createdAt: string; actor?: { firstName: string; lastName: string } | null }[]; page: number; pages: number }>(`/api/admin/audit?q=${encodeURIComponent(q)}&page=${page}`),
  });
  return (
    <div>
      <PageTitle title="Əməliyyat jurnalı" />
      <input className="mb-4 rounded-2xl border px-3 py-2 text-sm" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Əməliyyat və ya obyekt" />
      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-mist"><tr><th className="px-4 py-3">Əməliyyat</th><th>Kim</th><th>Obyekt</th><th>Tarix</th></tr></thead>
          <tbody>
            {query.data?.items.map((item) => (
              <tr key={item.id} className="border-t border-black/5">
                <td className="px-4 py-3">{actionLabel[item.action] || item.action}</td>
                <td>{item.actor ? `${item.actor.firstName} ${item.actor.lastName}` : "—"}</td>
                <td>{item.entity}</td>
                <td>{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data && query.data.pages > 1 ? (
        <div className="mt-3 flex gap-2">
          <Mini onClick={() => setPage((value) => Math.max(1, value - 1))}>Əvvəlki</Mini>
          <span className="py-1 text-sm">{query.data.page} / {query.data.pages}</span>
          <Mini onClick={() => setPage((value) => value + 1)}>Növbəti</Mini>
        </div>
      ) : null}
    </div>
  );
}

export function AdminSettingsPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const { reload } = useSettings();
  const query = useQuery({ queryKey: ["admin-settings"], queryFn: () => api<Record<string, string>>("/api/admin/settings"), enabled: user?.role === "SUPER_ADMIN" });
  const [form, setForm] = useState<Record<string, string> | null>(null);
  if (user?.role !== "SUPER_ADMIN") return <p className="rounded-2xl bg-white p-6 text-sm">Tənzimləmələr yalnız baş admin üçündür.</p>;
  const data = form || query.data;
  if (!data) return <p>Yüklənir...</p>;
  function set(key: string, value: string) {
    setForm({ ...(form || query.data || {}), [key]: value });
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
    <form className="max-w-2xl space-y-3 rounded-2xl border border-black/5 bg-white p-5" onSubmit={async (event) => {
      event.preventDefault();
      try {
        await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(form || query.data) });
        push("Tənzimləmələr yadda saxlandı");
        reload();
        query.refetch();
      } catch (error) {
        push(error instanceof Error ? error.message : "Saxlanmadı");
      }
    }}>
      <PageTitle title="Tənzimləmələr" />
      {fields.map(([key, label]) => (
        <label key={key} className="block text-sm font-medium">
          {label}
          {key === "seoDescription" ? (
            <textarea className="mt-1 w-full rounded-2xl border px-3 py-2" rows={3} value={data[key] || ""} onChange={(event) => set(key, event.target.value)} />
          ) : (
            <input className="mt-1 w-full rounded-2xl border px-3 py-2" value={data[key] || ""} onChange={(event) => set(key, event.target.value)} />
          )}
        </label>
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
      <button className="rounded-full bg-[#0c1412] px-5 py-2 text-sm font-bold text-white" type="submit">Yadda saxla</button>
    </form>
  );
}

export { AdminListingsPage } from "./AdminListings";
