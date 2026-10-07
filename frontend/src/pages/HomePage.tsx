import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ListingGrid } from "../components/ListingCard";
import { Seo } from "../components/Seo";
import { FullSpinner } from "../components/ui";
import { categoryIcon } from "../labels";
import { Category, City, Listing } from "../types";

type HomeData = {
  latest: Listing[];
  popular: Listing[];
  recommended: Listing[];
  cityListings: Listing[];
  cities: City[];
  categories: Category[];
};

export function HomePage() {
  const [city, setCity] = useState(localStorage.getItem("alver_city") || "");
  const query = useQuery({
    queryKey: ["home", city],
    queryFn: () => api<HomeData>(`/api/home${city ? `?city=${city}` : ""}`),
  });

  function chooseCity(slug: string) {
    setCity(slug);
    localStorage.setItem("alver_city", slug);
  }

  if (query.isLoading) return <FullSpinner />;
  if (query.isError || !query.data) return <p>Ana səhifə yüklənmədi. Serverin işlədiyini yoxlayın.</p>;
  const data = query.data;

  return (
    <div className="space-y-10">
      <Seo />
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-800 via-brand-700 to-[#14956a] px-6 py-10 text-white md:px-10">
        <p className="text-sm text-white/80">Yaxınlıqdakı elanlar</p>
        <h1 className="mt-2 max-w-xl text-3xl font-extrabold leading-tight md:text-5xl">Al, sat, yazış. Hamısı bir yerdə.</h1>
        <p className="mt-3 max-w-lg text-white/85">Telefon, elektronika, avtomobil və ev əşyaları. Satıcı ilə birbaşa mesajlaş.</p>
        <Link to="/elan-yerlesdir" className="mt-6 inline-flex rounded-full bg-ambercta px-5 py-3 text-sm font-bold text-ink">
          Elan yerləşdir
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Kateqoriyalar</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data.categories.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <Link key={category.id} to={`/kateqoriya/${category.slug}`} className="card flex flex-col items-center gap-2 px-2 py-4 text-center text-sm font-semibold">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Icon size={22} />
                </span>
                {category.name}
                <span className="text-xs font-medium text-mist">{category.count || 0} elan</span>
              </Link>
            );
          })}
        </div>
      </section>

      <Section title="Tövsiyə olunan elanlar" items={data.recommended} />
      <Section title="Son elanlar" items={data.latest} />
      <Section title="Populyar elanlar" items={data.popular} />

      <section>
        <h2 className="mb-4 text-xl font-bold">Şəhərlərə görə elanlar</h2>
        <div className="mb-4 flex gap-2 overflow-x-auto">
          <button type="button" onClick={() => chooseCity("")} className={`rounded-full px-3 py-1.5 text-sm ${city === "" ? "bg-brand-700 text-white" : "bg-white"}`}>
            Hamısı
          </button>
          {data.cities.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseCity(item.slug)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${city === item.slug ? "bg-brand-700 text-white" : "bg-white"}`}
            >
              {item.name} · {item.count || 0}
            </button>
          ))}
        </div>
        {city && data.cityListings.length === 0 ? <p className="text-sm text-mist">Bu şəhərdə hələ elan yoxdur.</p> : null}
        {city ? <ListingGrid items={data.cityListings} /> : <ListingGrid items={data.latest} />}
      </section>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Listing[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      <ListingGrid items={items} />
    </section>
  );
}
