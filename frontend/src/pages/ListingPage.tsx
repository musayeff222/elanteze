import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Flag, Heart, MapPin, Phone, Share2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ListingGrid } from "../components/ListingCard";
import { Seo } from "../components/Seo";
import { Button, Field, FullSpinner, Modal, inputClass } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatDate, formatPrice, fullName } from "../format";
import { conditionLabel, reportReasons } from "../labels";
import { Listing } from "../types";

export function ListingPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [photo, setPhoto] = useState(0);
  const [phone, setPhone] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [reason, setReason] = useState("FAKE");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [offerText, setOfferText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);

  const query = useQuery({
    queryKey: ["listing", slug],
    queryFn: () => api<{ listing: Listing }>(`/api/listings/${slug}`),
  });
  const similar = useQuery({
    queryKey: ["similar", slug],
    queryFn: () => api<{ items: Listing[] }>(`/api/listings/${slug}/similar`),
  });

  if (query.isLoading) return <FullSpinner />;
  if (query.isError || !query.data) return <p>Elan tapılmadı.</p>;
  const listing = query.data.listing;
  const images = listing.images || [];
  const active = images[photo] || images[0];

  async function favorite() {
    if (!user) return navigate("/giris");
    try {
      if (listing.isFavorite) await api(`/api/favorites/${listing.id}`, { method: "DELETE" });
      else await api(`/api/favorites/${listing.id}`, { method: "POST" });
      await query.refetch();
    } catch (error) {
      push(error instanceof Error ? error.message : "Alınmadı");
    }
  }

  async function message() {
    if (!user) return navigate(`/giris?next=/elan/${listing.slug}`);
    try {
      const data = await api<{ conversationId: string }>("/api/conversations", { method: "POST", body: JSON.stringify({ listingId: listing.id }) });
      navigate(`/mesajlar/${data.conversationId}`);
    } catch (error) {
      push(error instanceof Error ? error.message : "Mesaj açılmadı");
    }
  }

  async function revealPhone() {
    if (!user) return navigate("/giris");
    try {
      const data = await api<{ phone: string }>(`/api/listings/${listing.id}/phone`, { method: "POST" });
      setPhone(data.phone);
    } catch (error) {
      push(error instanceof Error ? error.message : "Nömrə açılmadı");
    }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: listing.title, url }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(url);
      push("Link kopyalandı");
    }
  }

  async function sendReport() {
    try {
      await api("/api/reports", { method: "POST", body: JSON.stringify({ listingId: listing.id, reason, details }) });
      setReportOpen(false);
      push("Şikayət qəbul edildi");
    } catch (error) {
      push(error instanceof Error ? error.message : "Şikayət göndərilmədi");
    }
  }

  async function sendOffer() {
    try {
      await api("/api/offers", { method: "POST", body: JSON.stringify({ listingId: listing.id, amount: Number(amount), message: offerText }) });
      setOfferOpen(false);
      push("Təklif göndərildi");
    } catch (error) {
      push(error instanceof Error ? error.message : "Təklif göndərilmədi");
    }
  }

  async function sendReview() {
    if (!listing.user) return;
    try {
      await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id, revieweeId: listing.user.id, rating, comment: reviewText }),
      });
      push("Rəy əlavə edildi");
      setReviewText("");
      client.invalidateQueries({ queryKey: ["reviews", listing.user.id] });
    } catch (error) {
      push(error instanceof Error ? error.message : "Rəy yazılmadı");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Seo title={listing.title} description={listing.description?.slice(0, 160)} image={active?.url} path={`/elan/${listing.slug}`} />
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <div className="aspect-[4/3] bg-brand-50">
            {active ? <img src={active.url} alt={listing.title} className="h-full w-full object-cover" /> : null}
          </div>
          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto p-3">
              {images.map((image, index) => (
                <button key={image.url} type="button" onClick={() => setPhoto(index)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${index === photo ? "border-brand-700" : "border-transparent"}`}>
                  <img src={image.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          {listing.videos?.[0] ? <video className="w-full" controls src={listing.videos[0].url} /> : null}
        </div>
        <div className="card space-y-3 p-5">
          <div className="text-3xl font-extrabold text-brand-800">{formatPrice(listing.price)}</div>
          <h1 className="text-2xl font-bold">{listing.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-mist">
            <span className="inline-flex items-center gap-1"><MapPin size={14} /> {listing.city?.name}{listing.district ? `, ${listing.district.name}` : ""}</span>
            <span>{formatDate(listing.createdAt)}</span>
            <span className="inline-flex items-center gap-1"><Eye size={14} /> {listing.viewCount} baxış</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6">{listing.description}</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Vəziyyət" value={conditionLabel[listing.condition]} />
            <Info label="Kateqoriya" value={[listing.category?.name, listing.subcategory?.name].filter(Boolean).join(" / ")} />
            {listing.brand ? <Info label="Brend" value={listing.brand} /> : null}
          </div>
        </div>
        {user && listing.user && user.id !== listing.user.id ? (
          <div className="card space-y-3 p-5">
            <h2 className="font-bold">Satıcıya rəy</h2>
            <p className="text-sm text-mist">Rəy yazmaq üçün bu elan üzrə satıcı ilə yazışma olmalıdır.</p>
            <select className={inputClass} value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} ulduz</option>)}
            </select>
            <textarea className={inputClass} rows={3} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="Rəyiniz" />
            <Button type="button" onClick={sendReview}>Rəy yaz</Button>
          </div>
        ) : null}
        <section>
          <h2 className="mb-3 text-xl font-bold">Oxşar elanlar</h2>
          <ListingGrid items={similar.data?.items || []} />
        </section>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-28 lg:self-start">
        <div className="card space-y-3 p-4">
          <Button className="w-full" type="button" onClick={message}>Mesaj yaz</Button>
          <Button className="w-full" variant="ghost" type="button" onClick={revealPhone}>
            <Phone size={16} /> {phone || "Telefonu göstər"}
          </Button>
          {phone ? <a className="block text-center text-sm font-semibold" href={`tel:${phone}`}>{phone}</a> : <p className="text-center text-sm text-mist">{listing.phoneMasked}</p>}
          <Button className="w-full" variant="soft" type="button" onClick={() => (user ? setOfferOpen(true) : navigate("/giris"))}>Təklif et</Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" type="button" onClick={favorite}><Heart size={16} className={listing.isFavorite ? "fill-red-500 text-red-500" : ""} /> Favori</Button>
            <Button variant="ghost" type="button" onClick={share}><Share2 size={16} /> Paylaş</Button>
            <Button variant="ghost" type="button" onClick={() => (user ? setReportOpen(true) : navigate("/giris"))}><Flag size={16} /> Şikayət</Button>
          </div>
        </div>
        {listing.user ? (
          <Link to={`/istifadeci/${listing.user.id}`} className="card block p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-brand-50 font-bold text-brand-800">
                {listing.user.avatarUrl ? <img src={listing.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : listing.user.firstName.slice(0, 1)}
              </span>
              <div>
                <div className="font-bold">{fullName(listing.user)}</div>
                <div className="text-sm text-mist">{listing.user.isOnline ? "Onlayn" : "Satıcı"} · {listing.user.rating || 0} / 5</div>
                <div className="text-xs text-mist">{listing.user.activeListings || 0} aktiv elan · {listing.user.reviewCount || 0} rəy</div>
              </div>
            </div>
          </Link>
        ) : null}
      </aside>
      {reportOpen ? (
        <Modal title="Şikayət et" onClose={() => setReportOpen(false)}>
          <div className="space-y-3">
            <Field label="Səbəb">
              <select className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)}>
                {reportReasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Əlavə qeyd">
              <textarea className={inputClass} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} />
            </Field>
            <Button type="button" onClick={sendReport}>Göndər</Button>
          </div>
        </Modal>
      ) : null}
      {offerOpen ? (
        <Modal title="Təklif et" onClose={() => setOfferOpen(false)}>
          <div className="space-y-3">
            <Field label="Məbləğ (AZN)"><input className={inputClass} type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
            <Field label="Mesaj"><textarea className={inputClass} rows={3} value={offerText} onChange={(event) => setOfferText(event.target.value)} /></Field>
            <Button type="button" onClick={sendOffer}>Təklifi göndər</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-2">
      <div className="text-xs text-mist">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export function SellerPage() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<"ACTIVE" | "SOLD">("ACTIVE");
  const profile = useQuery({ queryKey: ["seller", id], queryFn: () => api<{ user: Listing["user"] }>(`/api/users/${id}`) });
  const listings = useQuery({
    queryKey: ["seller-listings", id, tab],
    queryFn: () => api<{ items: Listing[] }>(`/api/users/${id}/listings?status=${tab}`),
  });
  const reviews = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => api<{ items: { id: string; rating: number; comment?: string | null; reviewer: { firstName: string; lastName: string } }[]; rating: number; count: number }>(`/api/reviews/user/${id}`),
  });
  if (profile.isLoading) return <FullSpinner />;
  if (!profile.data?.user) return <p>İstifadəçi tapılmadı.</p>;
  const seller = profile.data.user;
  return (
    <div className="space-y-6">
      <Seo title={fullName(seller)} path={`/istifadeci/${id}`} />
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-brand-50 text-2xl font-bold">
          {seller.avatarUrl ? <img src={seller.avatarUrl} alt="" className="h-full w-full object-cover" /> : seller.firstName.slice(0, 1)}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">{fullName(seller)}</h1>
          <p className="text-sm text-mist">{seller.bio}</p>
          <p className="mt-1 text-sm">{seller.city?.name} · üzv: {formatDate(seller.createdAt)} · reytinq {seller.rating || 0} ({seller.reviewCount || 0})</p>
          <p className="text-sm text-mist">{seller.activeListings || 0} aktiv elan · {seller.soldListings || 0} satılıb · {seller.isOnline ? "onlayn" : "oflayn"}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant={tab === "ACTIVE" ? "primary" : "ghost"} type="button" onClick={() => setTab("ACTIVE")}>Aktiv elanlar</Button>
        <Button variant={tab === "SOLD" ? "primary" : "ghost"} type="button" onClick={() => setTab("SOLD")}>Satılmış elanlar</Button>
      </div>
      <ListingGrid items={listings.data?.items || []} />
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Rəylər</h2>
        {(reviews.data?.items || []).length === 0 ? <p className="text-sm text-mist">Hələ rəy yoxdur.</p> : null}
        {reviews.data?.items.map((review) => (
          <article key={review.id} className="card p-4">
            <div className="font-semibold">{review.reviewer.firstName} {review.reviewer.lastName} · {review.rating}/5</div>
            <p className="text-sm">{review.comment}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
