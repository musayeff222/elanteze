import { Baby, Car, Dumbbell, Home, Laptop, LayoutGrid, LucideIcon, Shirt, Smartphone, Sofa, Tv, Wrench } from "lucide-react";
import { Condition, ListingStatus } from "./types";

export const conditionLabel: Record<Condition, string> = {
  NEW: "Yeni",
  LIKE_NEW: "Kimi yeni",
  GOOD: "Yaxşı",
  FAIR: "Orta",
  FOR_PARTS: "Ehtiyat üçün",
};

export const statusLabel: Record<ListingStatus, string> = {
  PENDING: "Gözləyir",
  ACTIVE: "Aktiv",
  REJECTED: "Rədd edilib",
  HIDDEN: "Gizli",
  SOLD: "Satılıb",
  EXPIRED: "Müddəti bitib",
  DELETED: "Silinib",
};

export const reportReasons = [
  { value: "FAKE", label: "Saxta elan" },
  { value: "FRAUD", label: "Fırıldaqçılıq" },
  { value: "SPAM", label: "Spam" },
  { value: "PROHIBITED", label: "Qadağan olunmuş məhsul" },
  { value: "WRONG_INFO", label: "Yanlış məlumat" },
  { value: "INAPPROPRIATE", label: "Uyğunsuz məzmun" },
  { value: "OTHER", label: "Digər" },
] as const;

export const sortOptions = [
  { value: "en-yeni", label: "Ən yeni" },
  { value: "en-ucuz", label: "Ən ucuz" },
  { value: "en-bahali", label: "Ən bahalı" },
  { value: "en-cox-baxilan", label: "Ən çox baxılan" },
];

export const dateOptions = [
  { value: "", label: "Bütün tarixlər" },
  { value: "bu-gun", label: "Bu gün" },
  { value: "hefte", label: "Son 7 gün" },
  { value: "ay", label: "Son 30 gün" },
];

const icons: Record<string, LucideIcon> = {
  Smartphone,
  Tv,
  Car,
  Home,
  Sofa,
  Shirt,
  Laptop,
  Baby,
  Dumbbell,
  Wrench,
  LayoutGrid,
};

export function categoryIcon(name?: string | null): LucideIcon {
  return (name && icons[name]) || LayoutGrid;
}

export const roleLabel: Record<string, string> = {
  USER: "İstifadəçi",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
  SUPER_ADMIN: "Baş admin",
};
