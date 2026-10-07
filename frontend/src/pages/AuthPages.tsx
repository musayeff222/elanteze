import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Seo } from "../components/Seo";
import { Button, Field, inputClass } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const logged = await login(email, password);
      const staff = ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(logged.role || "");
      navigate(params.get("next") || (staff ? "/admin" : "/"));
    } catch (error) {
      push(error instanceof Error ? error.message : "Giriş alınmadı");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-md space-y-4 p-6">
      <Seo title="Giriş" />
      <h1 className="text-2xl font-extrabold">Giriş</h1>
      <Field label="E-poçt"><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
      <Field label="Şifrə"><input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
      <Button className="w-full" type="submit">Daxil ol</Button>
      <div className="flex justify-between text-sm">
        <Link to="/qeydiyyat">Qeydiyyat</Link>
        <Link to="/sifre-unutdum">Şifrəni unutmusunuz?</Link>
      </div>
    </form>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
  const [dev, setDev] = useState<{ token?: string; code?: string }>({});

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await register(form);
      if (result.devEmailToken || result.devPhoneCode) setDev({ token: result.devEmailToken, code: result.devPhoneCode });
      push("Qeydiyyat tamamlandı");
      if (!result.devEmailToken) navigate("/");
    } catch (error) {
      push(error instanceof Error ? error.message : "Qeydiyyat alınmadı");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-md space-y-4 p-6">
      <Seo title="Qeydiyyat" />
      <h1 className="text-2xl font-extrabold">Qeydiyyat</h1>
      <Field label="Ad"><input className={inputClass} value={form.firstName} onChange={(event) => set("firstName", event.target.value)} required /></Field>
      <Field label="Soyad"><input className={inputClass} value={form.lastName} onChange={(event) => set("lastName", event.target.value)} required /></Field>
      <Field label="Telefon"><input className={inputClass} value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+99450XXXXXXX" required /></Field>
      <Field label="E-poçt"><input className={inputClass} type="email" value={form.email} onChange={(event) => set("email", event.target.value)} required /></Field>
      <Field label="Şifrə"><input className={inputClass} type="password" value={form.password} onChange={(event) => set("password", event.target.value)} required /></Field>
      <Button className="w-full" type="submit">Hesab yarat</Button>
      <Link to="/giris" className="block text-sm">Artıq hesabınız var? Giriş</Link>
      {dev.token ? (
        <div className="rounded-2xl bg-paper p-3 text-sm">
          <p>Development təsdiq linki:</p>
          <Link className="break-all font-semibold" to={`/email-tesdiq?token=${dev.token}`}>E-poçtu təsdiqlə</Link>
          {dev.code ? <p className="mt-2">Telefon kodu: {dev.code}</p> : null}
        </div>
      ) : null}
    </form>
  );
}

export function ForgotPage() {
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await api<{ message: string; devResetLink?: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      push(data.message);
      if (data.devResetLink) setLink(data.devResetLink);
    } catch (error) {
      push(error instanceof Error ? error.message : "Göndərilmədi");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-md space-y-4 p-6">
      <Seo title="Şifrəni unutdum" />
      <h1 className="text-2xl font-extrabold">Şifrəni unutdum</h1>
      <Field label="E-poçt"><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
      <Button type="submit">Bərpa linki göndər</Button>
      {link ? <a className="block break-all text-sm font-semibold" href={link}>{link}</a> : null}
    </form>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await api<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: params.get("token"), password }),
      });
      push(data.message);
      navigate("/giris");
    } catch (error) {
      push(error instanceof Error ? error.message : "Şifrə yenilənmədi");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-md space-y-4 p-6">
      <Seo title="Yeni şifrə" />
      <h1 className="text-2xl font-extrabold">Yeni şifrə</h1>
      <Field label="Yeni şifrə"><input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
      <Button type="submit">Şifrəni yenilə</Button>
    </form>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { push } = useToast();
  const { refreshUser } = useAuth();
  const [text, setText] = useState("Təsdiq gözlənilir...");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setText("Token tapılmadı");
      return;
    }
    api<{ message: string }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        setText(data.message);
        push(data.message);
        await refreshUser();
      })
      .catch((error) => setText(error instanceof Error ? error.message : "Təsdiq alınmadı"));
  }, [params, push, refreshUser]);

  return (
    <div className="card mx-auto max-w-md p-6">
      <Seo title="E-poçt təsdiqi" />
      <h1 className="text-2xl font-extrabold">E-poçt təsdiqi</h1>
      <p className="mt-3">{text}</p>
      <Link to="/" className="mt-4 inline-block font-semibold">Ana səhifə</Link>
    </div>
  );
}
