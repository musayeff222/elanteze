import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; text: string };

const ToastContext = createContext<{ push: (text: string) => void }>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-20 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2 md:bottom-6">
        {toasts.map((toast) => (
          <div key={toast.id} className="rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-card">
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
