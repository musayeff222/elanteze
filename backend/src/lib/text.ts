const MAP: Record<string, string> = {
  ə: "e",
  Ə: "e",
  ı: "i",
  I: "i",
  i: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ü: "u",
  Ü: "u",
  ş: "s",
  Ş: "s",
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
};

export function foldAz(input: string): string {
  const folded = Array.from(input)
    .map((char) => MAP[char] ?? char)
    .join("");
  return folded.toLowerCase();
}

export function slugify(input: string): string {
  const folded = foldAz(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = folded
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "elan";
}

export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("994")) national = national.slice(3);
  else if (national.startsWith("0")) national = national.slice(1);
  if (!/^(10|50|51|55|60|70|77|99)\d{7}$/.test(national)) {
    throw new Error("Telefon nömrəsi düzgün deyil");
  }
  return `+994${national}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 12) return "***";
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} *** ** ${digits.slice(-2)}`;
}

export function listingSlug(title: string, cityName: string, publicNumber: number): string {
  return `${slugify(title)}-${slugify(cityName)}-${publicNumber}`;
}
