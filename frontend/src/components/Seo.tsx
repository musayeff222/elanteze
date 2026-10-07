import { useEffect } from "react";
import { useSettings } from "../context/SettingsContext";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.content = content;
}

export function Seo({
  title,
  description,
  image,
  path,
}: {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
}) {
  const { settings } = useSettings();
  useEffect(() => {
    const fullTitle = title ? `${title} · ${settings.siteName}` : settings.seoTitle || settings.siteName;
    const desc = description || settings.seoDescription;
    const url = `${window.location.origin}${path || window.location.pathname}`;
    document.title = fullTitle;
    upsertMeta("name", "description", desc);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:locale", "az_AZ");
    if (image) {
      upsertMeta("property", "og:image", image.startsWith("http") ? image : `${window.location.origin}${image}`);
    }
    let canonical = document.head.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [title, description, image, path, settings]);
  return null;
}
