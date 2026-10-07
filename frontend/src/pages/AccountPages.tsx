import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, uploadFile } from "../api";
import { ListingGrid } from "../components/ListingCard";
import { Seo } from "../components/Seo";
import { Button, Empty, Field, FullSpinner, inputClass } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatDate, formatPrice } from "../format";
import { statusLabel } from "../labels";
import { AppNotification, City, Listing } from "../types";

export function FavoritesPage() {
  const query = useQuery({ queryKey: ["favorites"], queryFn: () => api<{ items: Listing[] }>("/api/favorites") });
  if (query.isLoading) return <FullSpinner />;
  return (
    <div>
      <Seo title="Favorilər" />
      <h1 className="mb-4 text-2xl font-extrabold">Favorilər</h1>
      {query.data?.items.length ? <ListingGrid items={query.data.items} onChange={() => query.refetch()} /> : <Empty title="Favori elan yoxdur" />}
    </div>
  );
}

export function NotificationsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ items: AppNotification[] }>("/api/notifications") });

  async function read(id: string, link?: string | null) {
    await api(`/api/notifications/${id}/read`, { method: "PATCH" });
    client.invalidateQueries({ queryKey: ["notifications"] });
    if (link) window.location.href = link;
  }

  return (
    <div>
      <Seo title="Bildirişlər" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Bildirişlər</h1>
        <Button variant="ghost" type="button" onClick={async () => { await api("/api/notifications/read-all", { method: "POST" }); query.refetch(); }}>Hamısını oxu</Button>
      </div>
      <div className="space-y-2">
        {(query.data?.items || []).length === 0 ? <Empty title="Bildiriş yoxdur" /> : null}
        {query.data?.items.map((item) => (
          <button key={item.id} type="button" onClick={() => read(item.id, item.link)} className={`card block w-full px-4 py-3 text-left ${item.isRead ? "opacity-70" : ""}`}>
            <div className="font-semibold">{item.title}</div>
            <p className="text-sm">{item.body}</p>
            <p className="text-xs text-mist">{formatDate(item.createdAt)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AccountPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "elanlar";
  const { user, refreshUser } = useAuth();
  const { push } = useToast();
  const client = useQueryClient();
  const listings = useQuery({ queryKey: ["mine"], queryFn: () => api<{ items: Listing[] }>("/api/listings/mine") });
  const cities = useQuery({ queryKey: ["cities"], queryFn: () => api<{ items: City[] }>("/api/cities") });
  const offers = useQuery({
    queryKey: ["offers"],
    queryFn: () => api<{ sent: { id: string; amount: number; status: string; listing: { title: string; slug: string } }[]; received: { id: string; amount: number; status: string; message?: string | null; listing: { title: string }; buyer: { firstName: string; lastName: string } }[] }>("/api/offers"),
  });
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [cityId, setCityId] = useState(user?.cityId || "");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setFirstName(user?.firstName || "");
    setLastName(user?.lastName || "");
    setBio(user?.bio || "");
    setCityId(user?.cityId || "");
  }, [user]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ firstName, lastName, bio, cityId: cityId || null }) });
      await refreshUser();
      push("Profil yeniləndi");
    } catch (error) {
      push(error instanceof Error ? error.message : "Saxlanmadı");
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await api<{ message: string }>("/api/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
      push(data.message);
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      push(error instanceof Error ? error.message : "Şifrə dəyişmədi");
    }
  }

  return (
    <div className="space-y-4">
      <Seo title="Hesabım" />
      <h1 className="text-2xl font-extrabold">Hesabım</h1>
      <div className="flex flex-wrap gap-2">
        {[
          ["elanlar", "Elanlarım"],
          ["profil", "Profil"],
          ["teklifler", "Təkliflər"],
        ].map(([key, label]) => (
          <Button key={key} type="button" variant={tab === key ? "primary" : "ghost"} onClick={() => setParams({ tab: key })}>{label}</Button>
        ))}
      </div>
      {tab === "elanlar" ? (
        listings.isLoading ? <FullSpinner /> : (
          <div className="space-y-3">
            {(listings.data?.items || []).length === 0 ? <Empty title="Elanınız yoxdur" text="İlk elanınızı yerləşdirin." /> : null}
            {listings.data?.items.map((listing) => (
              <article key={listing.id} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <img src={listing.images?.[0]?.thumbnailUrl} alt="" className="h-20 w-24 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <Link to={`/elan/${listing.slug}`} className="font-semibold">{listing.title}</Link>
                  <p className="text-sm text-mist">{formatPrice(listing.price)} · {statusLabel[listing.status]} · {listing.viewCount} baxış</p>
                  {listing.rejectionReason ? <p className="text-sm text-red-600">Səbəb: {listing.rejectionReason}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/elan/${listing.slug}/redakte`} className="rounded-full bg-paper px-3 py-2 text-sm font-semibold">Redaktə</Link>
                  {listing.status === "ACTIVE" ? (
                    <Button variant="ghost" type="button" onClick={async () => { await api(`/api/listings/${listing.id}/sold`, { method: "POST" }); listings.refetch(); }}>Satıldı</Button>
                  ) : null}
                  <Button variant="danger" type="button" onClick={async () => { await api(`/api/listings/${listing.id}`, { method: "DELETE" }); listings.refetch(); }}>Sil</Button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
      {tab === "profil" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={saveProfile} className="card space-y-3 p-5">
            <Field label="Ad"><input className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field>
            <Field label="Soyad"><input className={inputClass} value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field>
            <Field label="Bio"><textarea className={inputClass} rows={4} value={bio || ""} onChange={(event) => setBio(event.target.value)} /></Field>
            <Field label="Şəhər">
              <select className={inputClass} value={cityId || ""} onChange={(event) => setCityId(event.target.value)}>
                <option value="">Seçin</option>
                {cities.data?.items.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
              </select>
            </Field>
            <label className="block text-sm">Profil şəkli
              <input className="mt-2 block" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await uploadFile("/api/uploads/image", file);
                await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ avatarUrl: uploaded.url }) });
                await refreshUser();
                push("Şəkil yeniləndi");
              }} />
            </label>
            <p className="text-xs text-mist">Qeydiyyat: {formatDate(user?.createdAt)} · E-poçt: {user?.emailVerified ? "təsdiqli" : "təsdiqsiz"} · Telefon: {user?.phoneVerified ? "təsdiqli" : "təsdiqsiz"}</p>
            <Button type="submit">Yadda saxla</Button>
            {!user?.emailVerified ? <Button type="button" variant="ghost" onClick={async () => {
              const data = await api<{ message: string; devVerifyLink?: string }>("/api/auth/resend-email", { method: "POST" });
              push(data.devVerifyLink || data.message);
            }}>E-poçt təsdiqi göndər</Button> : null}
            {!user?.phoneVerified ? (
              <div className="space-y-2">
                <Button type="button" variant="ghost" onClick={async () => {
                  const data = await api<{ message: string; devPhoneCode?: string }>("/api/auth/resend-phone", { method: "POST" });
                  if (data.devPhoneCode) setDevCode(data.devPhoneCode);
                  push(data.message);
                }}>Telefon kodu göndər</Button>
                {devCode ? <p className="text-sm">Kod: {devCode}</p> : null}
                <div className="flex gap-2">
                  <input className={inputClass} value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 rəqəmli kod" />
                  <Button type="button" onClick={async () => {
                    try {
                      const data = await api<{ message: string }>("/api/auth/verify-phone", { method: "POST", body: JSON.stringify({ code }) });
                      push(data.message);
                      await refreshUser();
                    } catch (error) {
                      push(error instanceof Error ? error.message : "Kod yanlışdır");
                    }
                  }}>Təsdiqlə</Button>
                </div>
              </div>
            ) : null}
          </form>
          <form onSubmit={savePassword} className="card space-y-3 p-5">
            <h2 className="font-bold">Şifrə</h2>
            <Field label="Cari şifrə"><input className={inputClass} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
            <Field label="Yeni şifrə"><input className={inputClass} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
            <Button type="submit">Şifrəni dəyiş</Button>
          </form>
        </div>
      ) : null}
      {tab === "teklifler" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2">
            <h2 className="font-bold">Gələn təkliflər</h2>
            {(offers.data?.received || []).map((offer) => (
              <article key={offer.id} className="card p-3 text-sm">
                <p className="font-semibold">{offer.listing.title}</p>
                <p>{offer.buyer.firstName} {offer.buyer.lastName}: {offer.amount} ₼ · {offer.status}</p>
                <p>{offer.message}</p>
                {offer.status === "PENDING" ? (
                  <div className="mt-2 flex gap-2">
                    <Button type="button" onClick={async () => { await api(`/api/offers/${offer.id}`, { method: "PATCH", body: JSON.stringify({ status: "ACCEPTED" }) }); client.invalidateQueries({ queryKey: ["offers"] }); }}>Qəbul</Button>
                    <Button variant="ghost" type="button" onClick={async () => { await api(`/api/offers/${offer.id}`, { method: "PATCH", body: JSON.stringify({ status: "REJECTED" }) }); client.invalidateQueries({ queryKey: ["offers"] }); }}>Rədd</Button>
                  </div>
                ) : null}
              </article>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="font-bold">Göndərdiyim təkliflər</h2>
            {(offers.data?.sent || []).map((offer) => (
              <article key={offer.id} className="card p-3 text-sm">
                <Link to={`/elan/${offer.listing.slug}`} className="font-semibold">{offer.listing.title}</Link>
                <p>{offer.amount} ₼ · {offer.status}</p>
              </article>
            ))}
          </section>
        </div>
      ) : null}
    </div>
  );
}
