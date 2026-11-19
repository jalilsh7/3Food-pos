import { LogOut, UtensilsCrossed } from "lucide-react";
import type { ApiUser } from "@/lib/api/php-client";
import { ROLE_LABEL } from "./navigation";

export function PosTopbar({
  shop,
  logoUrl,
  user,
  onLogout,
}: {
  shop: string;
  logoUrl?: string | null;
  user: ApiUser;
  onLogout: () => void;
}) {
  return (
    <header className="pos-topbar sticky top-0 z-30 flex min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="لوگوی فروشگاه" className="h-11 w-11 rounded-2xl border border-line bg-surface object-contain p-1" />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-chili text-chili-ink shadow-sm"><UtensilsCrossed size={21} /></div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold tracking-tight sm:text-lg">{shop}</p>
          <p className="text-[11px] font-medium text-muted sm:text-xs">سامانه مدیریت و فروش 3Food</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden text-left sm:block">
          <p className="text-sm font-bold">{user.display_name}</p>
          <p className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf/10 text-sm font-bold text-leaf">{user.display_name.trim().slice(0, 1) || "ک"}</span>
        <button type="button" onClick={onLogout} className="pos-logout inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold sm:text-sm">
          <LogOut size={16} /><span className="hidden sm:inline">خروج امن</span>
        </button>
      </div>
    </header>
  );
}
