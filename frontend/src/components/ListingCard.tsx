import { Heart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatPrice, formatWhen } from "../format";
import { Listing } from "../types";
import { MouseEvent, useState } from "react";

export function ListingCard({ listing, onChange }: { listing: Listing; onChange?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [favorite, setFavorite] = useState(Boolean(listing.isFavorite));
  const image = listing.images?.[0];

  async function toggleFavorite(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      navigate("/giris");
      return;
    }
    try {
      if (favorite) {
        await api(`/api/favorites/${listing.id}`, { method: "DELETE" });
        setFavorite(false);
        push("Favoridən silindi");
      } else {
        await api(`/api/favorites/${listing.id}`, { method: "POST" });
        setFavorite(true);
        push("Favoriyə əlavə edildi");
      }
      onChange?.();
    } catch (error) {
      push(error instanceof Error ? error.message : "Əməliyyat alınmadı");
    }
  }

  return (
    <Link to={`/elan/${listing.slug}`} className="card group block overflow-hidden transition hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] bg-brand-50">
        {image ? <img src={image.thumbnailUrl || image.url} alt={listing.title} className="h-full w-full object-cover" /> : null}
        <button
          type="button"
          aria-label="Favori"
          onClick={toggleFavorite}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow"
        >
          <Heart size={18} className={favorite ? "fill-red-500 text-red-500" : "text-ink"} />
        </button>
        {listing.isFeatured ? <span className="absolute left-3 top-3 rounded-full bg-ink px-2 py-1 text-[11px] font-semibold text-white">Seçilmiş</span> : null}
      </div>
      <div className="space-y-1 p-3">
        <div className="text-lg font-extrabold text-brand-800">{formatPrice(listing.price)}</div>
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5">{listing.title}</h3>
        <p className="text-xs text-mist">
          {listing.city?.name}
          {listing.district ? `, ${listing.district.name}` : ""} · {formatWhen(listing.createdAt)}
        </p>
      </div>
    </Link>
  );
}

export function ListingGrid({ items, onChange }: { items: Listing[]; onChange?: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {items.map((listing) => (
        <ListingCard key={listing.id} listing={listing} onChange={onChange} />
      ))}
    </div>
  );
}
