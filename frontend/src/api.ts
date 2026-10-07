export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(status: number, message: string, errors?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession() {
  if (!refreshing) {
    refreshing = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...options, headers, credentials: "include" });
  const skipRefresh =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/refresh") ||
    path.startsWith("/api/auth/forgot-password") ||
    path.startsWith("/api/auth/reset-password");
  if (response.status === 401 && retry && !skipRefresh) {
    const ok = await refreshSession();
    if (ok) return api<T>(path, options, false);
  }
  const data = (await response.json().catch(() => ({}))) as { message?: string; errors?: { field: string; message: string }[] };
  if (!response.ok) throw new ApiError(response.status, data.message || "Xəta baş verdi", data.errors);
  return data as T;
}

export function uploadFile(path: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return api<{ url: string; thumbnailUrl?: string }>(path, { method: "POST", body });
}
