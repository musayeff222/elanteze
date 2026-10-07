import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../api";
import { Settings } from "../types";

const fallback: Settings = {
  siteName: "ALVER",
  logoUrl: "",
  faviconUrl: "",
  phone: "",
  email: "",
  whatsapp: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  seoTitle: "ALVER — Azərbaycanda elanlar",
  seoDescription: "ALVER-də elan yerləşdirin, axtarın və satıcı ilə birbaşa yazışın.",
};

const SettingsContext = createContext<{ settings: Settings; reload: () => void }>({ settings: fallback, reload: () => undefined });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(fallback);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api<Settings>("/api/settings")
      .then((data) => setSettings({ ...fallback, ...data }))
      .catch(() => setSettings(fallback));
  }, [tick]);

  useEffect(() => {
    const href = settings.faviconUrl || "/favicon.svg";
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [settings.faviconUrl]);

  return <SettingsContext.Provider value={{ settings, reload: () => setTick((n) => n + 1) }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
