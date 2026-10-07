import { prisma } from "../lib/prisma";

export const DEFAULT_SETTINGS: Record<string, string> = {
  siteName: "ALVER",
  logoUrl: "",
  faviconUrl: "",
  phone: "+994501112233",
  email: "elaqe@alver.az",
  whatsapp: "+994501112233",
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  tiktok: "https://www.tiktok.com/",
  seoTitle: "ALVER — Azərbaycanda elanlar",
  seoDescription: "ALVER-də telefon, elektronika, avtomobil, ev və digər elanları al və sat.",
  autoApproveListings: "false",
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany();
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

export async function getPublicSettings() {
  const settings = await getSettings();
  return {
    siteName: settings.siteName,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    phone: settings.phone,
    email: settings.email,
    whatsapp: settings.whatsapp,
    instagram: settings.instagram,
    facebook: settings.facebook,
    tiktok: settings.tiktok,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
  };
}
