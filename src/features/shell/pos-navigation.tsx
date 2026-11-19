import type { NavItem, View } from "./navigation";

export function PosNavigation({
  allowed,
  current,
  onSelect,
}: {
  allowed: NavItem[];
  current: View;
  onSelect: (view: View) => void;
}) {
  return (
    <nav aria-label="ناوبری اصلی" className="pos-nav min-w-0 lg:sticky lg:top-[92px] lg:flex lg:h-[calc(100vh-116px)] lg:flex-col">
      <div className="hidden px-3 pb-4 pt-2 lg:block">
        <p className="text-[10px] font-bold tracking-[0.18em] text-muted">WORKSPACE</p>
        <p className="mt-1 text-sm font-extrabold">دسترسی سریع</p>
      </div>
      <div className="pos-nav-list flex min-w-0 gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {allowed.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(item.id)}
              className={`pos-nav-item inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${active ? "is-active" : ""}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl"><Icon size={18} strokeWidth={2} /></span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto hidden rounded-2xl border border-line bg-surface/80 p-4 lg:block">
        <p className="text-xs font-bold text-ink">3Food POS</p>
        <p className="mt-1 text-[11px] leading-6 text-muted">مدیریت یکپارچه فروش، سفارش و موجودی</p>
        <span className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold text-leaf"><span className="h-1.5 w-1.5 rounded-full bg-leaf" /> سامانه فعال</span>
      </div>
    </nav>
  );
}
