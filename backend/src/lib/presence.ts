const online = new Map<string, number>();

export function markOnline(userId: string) {
  online.set(userId, (online.get(userId) || 0) + 1);
}

export function markOffline(userId: string) {
  const next = (online.get(userId) || 1) - 1;
  if (next <= 0) online.delete(userId);
  else online.set(userId, next);
}

export function isOnline(userId: string): boolean {
  return (online.get(userId) || 0) > 0;
}

export function onlineCount(): number {
  return online.size;
}
