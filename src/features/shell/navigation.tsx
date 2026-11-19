import { ClipboardList, LayoutDashboard, MessageSquare, Percent, Settings as SettingsIcon, ShoppingBag, Truck, UtensilsCrossed, Users, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/pos/model";

export type View = "pos" | "orders" | "menu" | "stock" | "customers" | "codes" | "reports" | "expenses" | "suppliers" | "sms" | "users" | "settings";

export type NavItem = {
  id: View;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

export const NAV: NavItem[] = [
  { id: "pos", label: "فروش", icon: ShoppingBag, roles: ["manager", "cashier"] },
  { id: "orders", label: "سفارش‌ها", icon: ClipboardList, roles: ["manager", "cashier", "kitchen"] },
  { id: "menu", label: "منو", icon: UtensilsCrossed, roles: ["manager"] },
  { id: "stock", label: "انبار", icon: Warehouse, roles: ["manager"] },
  { id: "customers", label: "باشگاه", icon: Users, roles: ["manager", "cashier"] },
  { id: "codes", label: "کد تخفیف", icon: Percent, roles: ["manager"] },
  { id: "reports", label: "گزارش", icon: LayoutDashboard, roles: ["manager"] },
  { id: "expenses", label: "هزینه‌ها", icon: ClipboardList, roles: ["manager"] },
  { id: "suppliers", label: "تأمین‌کنندگان", icon: Truck, roles: ["manager"] },
  { id: "sms", label: "پیامک", icon: MessageSquare, roles: ["manager"] },
  { id: "users", label: "کاربران", icon: Users, roles: ["manager"] },
  { id: "settings", label: "تنظیمات", icon: SettingsIcon, roles: ["manager"] },
];

export const ROLE_LABEL: Record<Role, string> = {
  manager: "مدیر",
  cashier: "صندوقدار",
  kitchen: "آشپز",
};
