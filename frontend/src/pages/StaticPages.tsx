import { FormEvent, useState } from "react";
import { Seo } from "../components/Seo";
import { Button, Field, inputClass } from "../components/ui";
import { useSettings } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";

export function AboutPage() {
  const { settings } = useSettings();
  return (
    <article className="card mx-auto max-w-3xl space-y-3 p-6">
      <Seo title="Haqqımızda" path="/haqqimizda" />
      <h1 className="text-3xl font-extrabold">{settings.siteName} haqqında</h1>
      <p>{settings.siteName} Azərbaycan üzrə elan platformasıdır. İnsanlar istifadə olunmuş və yeni əşyaları yaxınlığındakı alıcılarla birbaşa əlaqə quraraq satır.</p>
      <p>Elanlar moderasiyadan keçir, şikayətlər yoxlanılır və satıcı ilə alıcı platformanın içində yazışır.</p>
    </article>
  );
}

export function RulesPage() {
  return (
    <article className="card mx-auto max-w-3xl space-y-3 p-6">
      <Seo title="Qaydalar" path="/qaydalar" />
      <h1 className="text-3xl font-extrabold">İstifadə qaydaları</h1>
      <ul className="list-disc space-y-2 pl-5 text-sm">
        <li>Yalnız qanuni və sizə məxsus əşyaları yerləşdirin.</li>
        <li>Saxta qiymət, spam və qadağan olunmuş məhsul elanı silinir.</li>
        <li>Ödənişi platformadan kənar, üzbəüz və ehtiyatla edin.</li>
        <li>Şəxsi məlumatları elan açıqlamasında paylaşmayın.</li>
      </ul>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <article className="card mx-auto max-w-3xl space-y-3 p-6">
      <Seo title="Məxfilik" path="/mexfilik" />
      <h1 className="text-3xl font-extrabold">Məxfilik</h1>
      <p className="text-sm">Hesab məlumatları giriş, elan və yazışma üçün saxlanılır. Şifrələr hash formasında durur. Telefon nömrəsi elanda gizlədilir və yalnız daxil olmuş istifadəçi açdıqda göstərilir.</p>
    </article>
  );
}

export function ContactPage() {
  const { settings } = useSettings();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const subject = encodeURIComponent(`${settings.siteName} əlaqə: ${name}`);
    window.location.href = `mailto:${settings.email}?subject=${subject}&body=${encodeURIComponent(message)}`;
    push("E-poçt proqramı açılır");
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-xl space-y-3 p-6">
      <Seo title="Əlaqə" path="/elaqe" />
      <h1 className="text-3xl font-extrabold">Əlaqə</h1>
      <p className="text-sm text-mist">{settings.phone} · {settings.email} · WhatsApp {settings.whatsapp}</p>
      <Field label="Ad"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required /></Field>
      <Field label="Mesaj"><textarea className={inputClass} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} required /></Field>
      <Button type="submit">E-poçt göndər</Button>
    </form>
  );
}
