import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { FullSpinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const STAFF = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];

export function AdminLoginPage() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <FullSpinner />;
  if (user && STAFF.includes(user.role || "")) return <Navigate to="/admin" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const logged = await login(email, password);
      if (!STAFF.includes(logged.role || "")) {
        await logout();
        push("Bu giriş yalnız idarə heyəti üçündür");
        return;
      }
      navigate("/admin", { replace: true });
    } catch (error) {
      push(error instanceof Error ? error.message : "Giriş alınmadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#0c1412] p-10 text-white md:flex">
        <div className="text-2xl font-extrabold tracking-tight">ALVER</div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">İdarə paneli</p>
          <h1 className="mt-3 max-w-sm text-4xl font-extrabold leading-tight">Elanlar, insanlar və şikayətlər bir yerdə.</h1>
        </div>
        <p className="text-sm text-white/50">Yalnız moderator, admin və baş admin daxil ola bilər.</p>
      </section>
      <section className="flex items-center justify-center bg-[#f4f6f8] px-4 py-10">
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-8 shadow-card">
          <p className="text-sm font-semibold text-brand-700 md:hidden">ALVER idarə</p>
          <h2 className="mt-1 text-2xl font-extrabold">İdarə girişi</h2>
          <p className="mt-2 text-sm text-mist">Bu qapı yalnız idarə panelini açır.</p>
          {params.get("icaze") === "yox" || (user && !STAFF.includes(user.role || "")) ? (
            <div className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Bu hesabın idarə icazəsi yoxdur.
              {user ? (
                <button type="button" className="ml-2 font-semibold underline" onClick={() => logout()}>
                  Çıxış
                </button>
              ) : null}
            </div>
          ) : null}
          <label className="mt-5 block text-sm font-medium">
            E-poçt
            <input className="mt-1 w-full rounded-2xl border border-black/10 px-3 py-3 outline-none ring-brand-700 focus:ring-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="mt-3 block text-sm font-medium">
            Şifrə
            <input className="mt-1 w-full rounded-2xl border border-black/10 px-3 py-3 outline-none ring-brand-700 focus:ring-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="mt-5 w-full rounded-full bg-[#0c1412] py-3 text-sm font-bold text-white disabled:opacity-60" type="submit" disabled={busy}>
            {busy ? "Yoxlanılır..." : "Panelə daxil ol"}
          </button>
          <Link to="/" className="mt-4 block text-center text-sm text-mist">Sayta qayıt</Link>
        </form>
      </section>
    </div>
  );
}
