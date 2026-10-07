import { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "accent" | "ghost" | "danger" | "soft" }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-800",
    accent: "bg-ambercta text-ink hover:brightness-95",
    ghost: "bg-white text-ink border border-black/10 hover:bg-paper",
    danger: "bg-red-600 text-white hover:bg-red-700",
    soft: "bg-brand-50 text-brand-800 hover:bg-brand-100",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none ring-brand-600 focus:ring-2";

export function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-100 border-t-brand-700" />;
}

export function FullSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="card px-6 py-14 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {text ? <p className="mt-2 text-sm text-mist">{text}</p> : null}
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-card" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="rounded-full px-2 py-1 text-sm text-mist" onClick={onClose} type="button">
            Bağla
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">
        Əvvəlki
      </Button>
      <span className="text-sm text-mist">
        {page} / {pages}
      </span>
      <Button variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} type="button">
        Növbəti
      </Button>
    </div>
  );
}
