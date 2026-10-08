import {
  Bell,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useSocket } from "../context/SocketContext";
import { categoryIcon } from "../labels";
import { Category } from "../types";
import { fullName } from "../format";

function Logo() {
  const { settings } = useSettings();
  return (
    <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight text-brand-800">
      {settings.logoUrl ? (
        <img src={settings.logoUrl} alt={settings.siteName} className="h-9 w-9 rounded-xl object-cover" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-sm text-white">A</span>
      )}
      <span className="text-xl">{settings.siteName}</span>
    </Link>
  );
}

export function Layout() {
  const { settings } = useSettings();
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<{ listings: { title: string; slug: string }[]; categories: { name: string; slug: string }[] }>({
    listings: [],
    categories: [],
  });
  const [openSuggest, setOpenSuggest] = useState(false);
  const [badges, setBadges] = useState({ messages: 0, notifications: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    api<{ items: Category[] }>("/api/categories")
      .then((data) => setCategories(data.items))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!user) {
      setBadges({ messages: 0, notifications: 0 });
      return;
    }
    const load = () => api<{ messages: number; notifications: number }>("/api/badges").then(setBadges).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const bump = () => {
      api<{ messages: number; notifications: number }>("/api/badges").then(setBadges).catch(() => undefined);
    };
    socket.on("notification:new", bump);
    socket.on("message:new", bump);
    return () => {
      socket.off("notification:new", bump);
      socket.off("message:new", bump);
    };
  }, [socket]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions({ listings: [], categories: [] });
      return;
    }
    const timer = window.setTimeout(() => {
      api<{ listings: { title: string; slug: string }[]; categories: { name: string; slug: string }[] }>(
        `/api/search/suggest?q=${encodeURIComponent(q.trim())}`,
      )
        .then((data) => {
          setSuggestions(data);
          setOpenSuggest(true);
        })
        .catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setOpenSuggest(false);
    navigate(`/axtaris?q=${encodeURIComponent(q.trim())}`);
  }

  const staff = user && ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(user.role || "");
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") || "";
  const hideCategories =
    location.pathname === "/elan-yerlesdir" ||
    /^\/elan\/[^/]+\/redakte$/.test(location.pathname) ||
    location.pathname === "/mesajlar" ||
    location.pathname.startsWith("/mesajlar/") ||
    next.startsWith("/elan-yerlesdir") ||
    /^\/elan\/[^/]+\/redakte/.test(next) ||
    next.startsWith("/mesajlar");

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="container-app flex h-[72px] items-center gap-3">
          <Logo />
          <form onSubmit={onSearch} className="relative hidden min-w-0 flex-1 md:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist" size={18} />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onFocus={() => suggestions.listings.length + suggestions.categories.length > 0 && setOpenSuggest(true)}
              placeholder="Məhsul, marka və ya xidmət axtar..."
              className="w-full rounded-full border border-black/10 bg-paper py-3 pl-11 pr-4 text-sm outline-none ring-brand-600 focus:ring-2"
            />
            {openSuggest && (suggestions.listings.length > 0 || suggestions.categories.length > 0) ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card">
                {suggestions.categories.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-paper"
                    onClick={() => {
                      setOpenSuggest(false);
                      navigate(`/kateqoriya/${item.slug}`);
                    }}
                  >
                    Kateqoriya: {item.name}
                  </button>
                ))}
                {suggestions.listings.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-paper"
                    onClick={() => {
                      setOpenSuggest(false);
                      navigate(`/elan/${item.slug}`);
                    }}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
          </form>
          <Link to="/elan-yerlesdir" className="hidden items-center gap-2 rounded-full bg-ambercta px-4 py-2.5 text-sm font-bold text-ink md:inline-flex">
            <Plus size={16} /> Elan yerləşdir
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <IconLink to="/favoriler" label="Favorilər" icon={<Heart size={20} />} />
            <IconLink to="/mesajlar" label="Mesajlar" icon={<MessageCircle size={20} />} badge={badges.messages} />
            <IconLink to="/bildirisler" label="Bildirişlər" icon={<Bell size={20} />} badge={badges.notifications} />
            {user ? (
              <div className="group relative">
                <Link to="/hesab" className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-paper">
                  <Avatar user={user} />
                  <span className="max-w-28 truncate text-sm font-semibold">{fullName(user)}</span>
                </Link>
                <div className="invisible absolute right-0 top-12 w-52 rounded-2xl border border-black/5 bg-white p-2 opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100">
                  <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-paper" to="/hesab">
                    Elanlarım
                  </Link>
                  <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-paper" to="/hesab?tab=profil">
                    Profil
                  </Link>
                  {staff ? (
                    <Link className="block rounded-xl px-3 py-2 text-sm hover:bg-paper" to="/admin">
                      İdarəetmə
                    </Link>
                  ) : null}
                  <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper" type="button" onClick={() => logout()}>
                    Çıxış
                  </button>
                </div>
              </div>
            ) : (
              <Link to="/giris" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-paper">
                Giriş
              </Link>
            )}
          </nav>
          <button className="ml-auto md:hidden" type="button" onClick={() => setMenu(true)} aria-label="Menyu">
            <Menu />
          </button>
        </div>
        {hideCategories ? null : (
          <div className="container-app flex gap-2 overflow-x-auto pb-3">
            {categories.map((category) => {
              const Icon = categoryIcon(category.icon);
              return (
                <Link
                  key={category.id}
                  to={`/kateqoriya/${category.slug}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-sm font-medium hover:bg-brand-50"
                >
                  <Icon size={16} /> {category.name}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {user && user.emailVerified === false && user.phoneVerified === false ? (
        <div className="bg-amber-50 text-center text-sm text-amber-950">
          <div className="container-app py-2">
            Elan yerləşdirmək üçün e-poçt və ya telefonu təsdiqləyin.{" "}
            <Link to="/hesab?tab=profil" className="font-semibold underline">
              Təsdiqə keç
            </Link>
          </div>
        </div>
      ) : null}

      <main className="container-app py-6">
        <Outlet />
      </main>

      <footer className="mt-8 border-t border-black/5 bg-white">
        <div className="container-app grid gap-6 py-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-mist">Azərbaycanda yaxınlıqdakı elanları tap, sat və yazış.</p>
          </div>
          <div className="space-y-2 text-sm">
            <Link className="block" to="/haqqimizda">Haqqımızda</Link>
            <Link className="block" to="/qaydalar">İstifadə qaydaları</Link>
            <Link className="block" to="/mexfilik">Məxfilik</Link>
            <Link className="block" to="/elaqe">Əlaqə</Link>
          </div>
          <div className="space-y-2 text-sm text-mist">
            {settings.phone ? <p>{settings.phone}</p> : null}
            {settings.email ? <p>{settings.email}</p> : null}
          </div>
          <div className="flex gap-3 text-sm font-semibold">
            {settings.instagram ? <a href={settings.instagram} target="_blank" rel="noreferrer">Instagram</a> : null}
            {settings.facebook ? <a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a> : null}
            {settings.tiktok ? <a href={settings.tiktok} target="_blank" rel="noreferrer">TikTok</a> : null}
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-black/10 bg-white md:hidden">
        <Tab to="/" icon={<Home size={20} />} label="Ana səhifə" />
        <Tab to="/axtaris" icon={<Search size={20} />} label="Axtarış" />
        <Tab to="/elan-yerlesdir" icon={<Plus size={20} />} label="Elan" />
        <Tab to="/mesajlar" icon={<MessageCircle size={20} />} label="Mesajlar" badge={badges.messages} />
        <Tab to={user ? "/hesab" : "/giris"} icon={<UserRound size={20} />} label="Profil" />
      </nav>

      {menu ? (
        <div className="fixed inset-0 z-50 bg-white p-4 md:hidden">
          <div className="mb-4 flex items-center justify-between">
            <Logo />
            <button type="button" onClick={() => setMenu(false)} aria-label="Bağla">
              <X />
            </button>
          </div>
          <form
            onSubmit={(event) => {
              onSearch(event);
              setMenu(false);
            }}
          >
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Məhsul, marka və ya xidmət axtar..." className="w-full rounded-2xl border px-4 py-3" />
          </form>
          <div className="mt-4 space-y-2 text-sm font-semibold">
            <Link onClick={() => setMenu(false)} className="block rounded-xl bg-paper px-3 py-3" to="/favoriler">Favorilər</Link>
            <Link onClick={() => setMenu(false)} className="block rounded-xl bg-paper px-3 py-3" to="/bildirisler">Bildirişlər</Link>
            {user ? (
              <button className="block w-full rounded-xl bg-paper px-3 py-3 text-left" type="button" onClick={() => { setMenu(false); logout(); }}>
                Çıxış
              </button>
            ) : (
              <Link onClick={() => setMenu(false)} className="block rounded-xl bg-paper px-3 py-3" to="/giris">Giriş</Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ user }: { user: { avatarUrl?: string | null; firstName: string } }) {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />;
  return <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{user.firstName.slice(0, 1)}</span>;
}

function IconLink({ to, label, icon, badge = 0 }: { to: string; label: string; icon: ReactNode; badge?: number }) {
  return (
    <Link to={to} aria-label={label} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-paper">
      {icon}
      {badge > 0 ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{badge}</span> : null}
    </Link>
  );
}

function Tab({ to, icon, label, badge = 0 }: { to: string; icon: ReactNode; label: string; badge?: number }) {
  return (
    <NavLink to={to} className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2 text-[11px] ${isActive ? "text-brand-700" : "text-mist"}`}>
      {icon}
      {label}
      {badge > 0 ? <span className="absolute right-4 top-1 h-2 w-2 rounded-full bg-red-500" /> : null}
    </NavLink>
  );
}
