import { useQuery } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, uploadFile } from "../api";
import { Seo } from "../components/Seo";
import { Button, Field, FullSpinner, inputClass } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { conditionLabel } from "../labels";
import { Category, City, Condition, Listing, ListingImage } from "../types";

type DraftImage = ListingImage & { localId: string };

export function CreateListingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<Condition>("GOOD");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<{ items: Category[] }>("/api/categories") });
  const cities = useQuery({ queryKey: ["cities"], queryFn: () => api<{ items: City[] }>("/api/cities") });
  const existing = useQuery({
    queryKey: ["edit-listing", slug],
    enabled: Boolean(slug),
    queryFn: () => api<{ listing: Listing }>(`/api/listings/${slug}`),
  });

  useEffect(() => {
    const listing = existing.data?.listing;
    if (!listing) return;
    setListingId(listing.id);
    setTitle(listing.title);
    setDescription(listing.description || "");
    setPrice(String(listing.price));
    setCondition(listing.condition);
    setBrand(listing.brand || "");
    setCategoryId(listing.category?.id || "");
    setSubcategoryId(listing.subcategory?.id || "");
    setCityId(listing.city?.id || "");
    setDistrictId(listing.district?.id || "");
    setPhone(listing.phone || "");
    setImages((listing.images || []).map((image, index) => ({ ...image, localId: image.id || String(index) })));
    setVideoUrl(listing.videos?.[0]?.url || "");
  }, [existing.data]);

  const category = categories.data?.items.find((item) => item.id === categoryId);
  const city = cities.data?.items.find((item) => item.id === cityId);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 10 - images.length);
    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        push("Yalnız şəkil faylı seçin");
        continue;
      }
      try {
        const saved = await uploadFile("/api/uploads/image", file);
        setImages((prev) => [
          ...prev,
          { localId: saved.url, url: saved.url, thumbnailUrl: saved.thumbnailUrl || saved.url, isCover: prev.length === 0 },
        ]);
      } catch (error) {
        push(error instanceof Error ? error.message : "Şəkil yüklənmədi");
      }
    }
  }

  async function addVideo(file: File) {
    try {
      const saved = await uploadFile("/api/uploads/video", file);
      setVideoUrl(saved.url);
    } catch (error) {
      push(error instanceof Error ? error.message : "Video yüklənmədi");
    }
  }

  function reorder(from: number, to: number) {
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!images.length) {
      push("Ən azı bir şəkil əlavə edin");
      setStep(0);
      return;
    }
    const cover = images.findIndex((image) => image.isCover);
    const payload = {
      title,
      description,
      price: Number(price),
      condition,
      brand: brand || null,
      phone,
      categoryId,
      subcategoryId: subcategoryId || null,
      cityId,
      districtId: districtId || null,
      images: images.map((image, index) => ({
        url: image.url,
        thumbnailUrl: image.thumbnailUrl,
        isCover: cover === -1 ? index === 0 : index === cover,
      })),
      videos: videoUrl ? [{ url: videoUrl }] : [],
    };
    setBusy(true);
    try {
      const path = listingId ? `/api/listings/${listingId}` : "/api/listings";
      const method = listingId ? "PATCH" : "POST";
      const data = await api<{ listing: Listing; message: string }>(path, { method, body: JSON.stringify(payload) });
      push(data.message);
      navigate(`/elan/${data.listing.slug}`);
    } catch (error) {
      push(error instanceof Error ? error.message : "Elan saxlanmadı");
    } finally {
      setBusy(false);
    }
  }

  if (slug && existing.isLoading) return <FullSpinner />;

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <Seo title={listingId ? "Elanı redaktə et" : "Elan yerləşdir"} />
      <h1 className="text-3xl font-extrabold">{listingId ? "Elanı redaktə et" : "Elan yerləşdir"}</h1>
      <div className="flex gap-2 text-sm">
        {["Şəkillər", "Məlumat", "Ünvan", "Yoxlama"].map((label, index) => (
          <button key={label} type="button" onClick={() => setStep(index)} className={`rounded-full px-3 py-1.5 ${step === index ? "bg-brand-700 text-white" : "bg-white"}`}>
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <section className="card space-y-4 p-5">
          <div
            className="rounded-3xl border-2 border-dashed border-brand-100 bg-brand-50 px-4 py-10 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
            }}
          >
            <p className="font-semibold">Şəkilləri buraya atın</p>
            <p className="text-sm text-mist">JPG, PNG və ya WEBP. Ən çox 10 şəkil, hər biri 8 MB.</p>
            <label className="mt-3 inline-block cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-semibold">
              Fayl seç
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => event.target.files && void addFiles(event.target.files)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((image, index) => (
              <div
                key={image.localId}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                className="relative aspect-square overflow-hidden rounded-2xl bg-paper"
              >
                <img src={image.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                <button type="button" className="absolute left-2 top-2 rounded-full bg-white p-1" onClick={() => setImages((prev) => prev.map((item, i) => ({ ...item, isCover: i === index })))}>
                  <Star size={16} className={image.isCover ? "fill-ambercta text-ambercta" : ""} />
                </button>
                <button type="button" className="absolute right-2 top-2 rounded-full bg-white p-1" onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <label className="block text-sm">
            Video (istəyə bağlı, MP4/WEBM, 30 MB)
            <input className="mt-2 block" type="file" accept="video/mp4,video/webm" onChange={(event) => event.target.files?.[0] && void addVideo(event.target.files[0])} />
          </label>
          {videoUrl ? <p className="text-sm text-brand-700">Video yükləndi</p> : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="card grid gap-4 p-5">
          <Field label="Başlıq"><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} required minLength={5} /></Field>
          <Field label="Kateqoriya">
            <select className={inputClass} value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} required>
              <option value="">Seçin</option>
              {categories.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Alt kateqoriya">
            <select className={inputClass} value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)}>
              <option value="">Seçin</option>
              {category?.children?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Qiymət (AZN)"><input className={inputClass} type="number" min={0} value={price} onChange={(event) => setPrice(event.target.value)} required /></Field>
          <Field label="Vəziyyət">
            <select className={inputClass} value={condition} onChange={(event) => setCondition(event.target.value as Condition)}>
              {Object.entries(conditionLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Brend"><input className={inputClass} value={brand} onChange={(event) => setBrand(event.target.value)} /></Field>
          <Field label="Açıqlama"><textarea className={inputClass} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} required minLength={20} /></Field>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card grid gap-4 p-5">
          <Field label="Şəhər">
            <select className={inputClass} value={cityId} onChange={(event) => { setCityId(event.target.value); setDistrictId(""); }} required>
              <option value="">Seçin</option>
              {cities.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Rayon">
            <select className={inputClass} value={districtId} onChange={(event) => setDistrictId(event.target.value)} required={Boolean(city?.districts?.length)}>
              <option value="">Seçin</option>
              {city?.districts?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Telefon"><input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+99450XXXXXXX" required /></Field>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card space-y-2 p-5 text-sm">
          <h2 className="text-lg font-bold">{title || "Başlıq yoxdur"}</h2>
          <p>{price || "0"} ₼ · {conditionLabel[condition]}</p>
          <p>{category?.name} {city?.name}</p>
          <p className="text-mist">{images.length} şəkil{videoUrl ? ", 1 video" : ""}</p>
          <p className="whitespace-pre-wrap">{description}</p>
        </section>
      ) : null}

      <div className="flex justify-between">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Geri</Button>
        {step < 3 ? (
          <Button type="button" onClick={() => setStep((value) => value + 1)}>Davam et</Button>
        ) : (
          <Button type="submit" disabled={busy}>{busy ? "Göndərilir..." : "Elanı yayımla"}</Button>
        )}
      </div>
    </form>
  );
}
