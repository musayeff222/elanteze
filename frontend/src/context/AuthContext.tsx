import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { firstName: string; lastName: string; phone: string; email: string; password: string }) => Promise<{ user: User; devEmailToken?: string; devPhoneCode?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api<{ user: User }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload: { firstName: string; lastName: string; phone: string; email: string; password: string }) => {
    const data = await api<{ user: User; devEmailToken?: string; devPhoneCode?: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading, login, register, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider yoxdur");
  return ctx;
}
