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
  "w-full rounded-xl border border-line bg-surface px-3 py-3 text-ink outline-none focus:border-chili";

export function Btn({
  children,
  onClick,
  tone = "chili",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "chili" | "leaf" | "ghost" | "ink";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const map = {
    chili: "bg-chili text-chili-ink",
    leaf: "bg-leaf text-leaf-ink",
    ghost: "bg-surface text-ink border border-line",
    ink: "bg-ink text-bg",
  } as const;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${map[tone]}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-muted">{text}</p>;
}
