export function formatPrice(value: number) {
  if (!value) return "Pulsuz";
  return `${new Intl.NumberFormat("az-AZ").format(value)} ₼`;
}

const azMonths = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

export function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${azMonths[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "indi";
  if (diff < hour) return `${Math.floor(diff / minute)} dəq əvvəl`;
  if (diff < day) return `${Math.floor(diff / hour)} saat əvvəl`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} gün əvvəl`;
  return formatDate(value);
}

export function fullName(user?: { firstName?: string; lastName?: string } | null) {
  if (!user) return "İstifadəçi";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim();
}
