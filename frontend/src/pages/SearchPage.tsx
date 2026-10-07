import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ListingGrid } from "../components/ListingCard";
import { Seo } from "../components/Seo";
import { Button, Empty, FullSpinner, Pagination, inputClass } from "../components/ui";
import { conditionLabel, dateOptions, sortOptions } from "../labels";
import { Category, City, Listing, PageResult } from "../types";

export function SearchPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get("q") || "");
  const [mobileFilters, setMobileFilters] = useState(false);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<{ items: Category[] }>("/api/categories") });
  const cities = useQuery({ queryKey: ["cities"], queryFn: () => api<{ items: City[] }>("/api/cities") });

  const category = slug || params.get("kateqoriya") || "";
  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    const q = params.get("q");
    if (q) search.set("q", q);
    if (category) search.set("category", category);
    const map: Record<string, string> = {
      alt: "subcategory",
      seher: "city",
      rayon: "district",
      veziyyet: "condition",
      brend: "brand",
      min: "minPrice",
      max: "maxPrice",
      tarix: "date",
      sirala: "sort",
      sehife: "page",
    };
    Object.entries(map).forEach(([from, to]) => {
      const value = params.get(from);
      if (value) search.set(to, value);
    });
    return search.toString();
  }, [params, category]);

  const listings = useQuery({
    queryKey: ["listings", queryString],
    queryFn: () => api<PageResult<Listing>>(`/api/listings?${queryString}`),
  });

  useEffect(() => {
    setDraft(params.get("q") || "");
  }, [params]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "sehife") next.delete("sehife");
    setParams(next);
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setParam("q", draft.trim());
  }

  const selectedCity = cities.data?.items.find((item) => item.slug === params.get("seher") || item.id === params.get("seher"));
  const categoryName = categories.data?.items.find((item) => item.slug === category)?.name;

  return (
    <div>
      <Seo title={categoryName || params.get("q") || "Axtarış"} path={slug ? `/kateqoriya/${slug}` : "/axtaris"} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{categoryName || "Axtarış"}</h1>
          <p className="text-sm text-mist">{listings.data ? `${listings.data.total} elan` : ""}</p>
        </div>
        <Button variant="ghost" className="lg:hidden" type="button" onClick={() => setMobileFilters(true)}>
          <SlidersHorizontal size={16} /> Filter
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className={`${mobileFilters ? "fixed inset-0 z-50 overflow-auto bg-white p-4" : "hidden"} lg:static lg:block lg:bg-transparent lg:p-0`}>
          <form onSubmit={onSearch} className="card space-y-3 p-4">
            <input className={inputClass} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Məhsul, marka və ya xidmət axtar..." />
            <select className={inputClass} value={params.get("kateqoriya") || category} onChange={(event) => {
              if (slug) navigate(`/axtaris?kateqoriya=${event.target.value}`);
              else setParam("kateqoriya", event.target.value);
            }}>
              <option value="">Bütün kateqoriyalar</option>
              {categories.data?.items.map((item) => (
                <option key={item.id} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <select className={inputClass} value={params.get("seher") || ""} onChange={(event) => { setParam("seher", event.target.value); setParam("rayon", ""); }}>
              <option value="">Bütün şəhərlər</option>
              {cities.data?.items.map((item) => (
                <option key={item.id} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <select className={inputClass} value={params.get("rayon") || ""} onChange={(event) => setParam("rayon", event.target.value)}>
              <option value="">Bütün rayonlar</option>
              {selectedCity?.districts?.map((item) => (
                <option key={item.id} value={item.slug}>{item.name}</option>
              ))}
            </select>
            <select className={inputClass} value={params.get("veziyyet") || ""} onChange={(event) => setParam("veziyyet", event.target.value)}>
              <option value="">Vəziyyət</option>
              {Object.entries(conditionLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input className={inputClass} placeholder="Brend" value={params.get("brend") || ""} onChange={(event) => setParam("brend", event.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} type="number" min={0} placeholder="Min ₼" value={params.get("min") || ""} onChange={(event) => setParam("min", event.target.value)} />
              <input className={inputClass} type="number" min={0} placeholder="Maks ₼" value={params.get("max") || ""} onChange={(event) => setParam("max", event.target.value)} />
            </div>
            <select className={inputClass} value={params.get("tarix") || ""} onChange={(event) => setParam("tarix", event.target.value)}>
              {dateOptions.map((item) => (
                <option key={item.label} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select className={inputClass} value={params.get("sirala") || "en-yeni"} onChange={(event) => setParam("sirala", event.target.value)}>
              {sortOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <Button type="submit" className="w-full">Axtar</Button>
            <button
              type="button"
              className="w-full text-sm text-mist"
              onClick={() => {
                setDraft("");
                setParams(new URLSearchParams());
                setMobileFilters(false);
              }}
            >
              Filteri təmizlə
            </button>
            <Button type="button" variant="ghost" className="w-full lg:hidden" onClick={() => setMobileFilters(false)}>
              Nəticələrə bax
            </Button>
          </form>
        </aside>
        <div>
          {listings.isLoading ? <FullSpinner /> : null}
          {listings.data && listings.data.items.length === 0 ? <Empty title="Elan tapılmadı" text="Filteri dəyişib yenidən yoxlayın." /> : null}
          {listings.data ? <ListingGrid items={listings.data.items} /> : null}
          {listings.data ? (
            <Pagination page={listings.data.page} pages={listings.data.pages} onPage={(page) => setParam("sehife", String(page))} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
