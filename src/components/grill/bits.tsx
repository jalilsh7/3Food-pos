import type { ReactNode } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-3 text-ink outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-leaf/40 focus:border-chili focus:ring-4 focus:ring-chili/10";

export function Btn({
  children,
  onClick,
  tone = "chili",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "chili" | "leaf" | "ghost" | "ink";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const map = {
    chili: "bg-chili text-chili-ink",
    leaf: "bg-leaf text-leaf-ink",
    ghost: "bg-surface text-ink border border-line",
    ink: "bg-chili text-chili-ink",
  } as const;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chili/30 disabled:translate-y-0 disabled:opacity-50 ${map[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-line/80 bg-surface p-5 shadow-[0_8px_28px_rgba(20,45,30,0.045)] transition-shadow duration-200 ${className}`}>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-muted">{text}</p>;
}
