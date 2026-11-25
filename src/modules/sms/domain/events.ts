import type { OrderStatus, SmsEvent } from "@/lib/pos/model";

export const SMS_EVENT_STATUS: Partial<Record<SmsEvent, OrderStatus>> = {
  order_created: "new",
  order_preparing: "preparing",
  order_ready: "ready",
  order_dispatched: "dispatched",
  order_delivered: "delivered",
  order_cancelled: "cancelled",
};

export const SMS_EVENT_LABEL: Record<SmsEvent, string> = {
  order_created: "جدید",
  order_preparing: "در حال آماده‌سازی",
  order_ready: "آماده",
  order_dispatched: "ارسال شد",
  order_delivered: "تحویل شد",
  order_cancelled: "لغو شد",
  order_invoice: "ریز فاکتور",
  points_earned: "کسب امتیاز",
  discount_used: "استفاده از کد",
};

export const SMS_TEMPLATE_EVENTS: SmsEvent[] = [
  "order_created", "order_preparing", "order_ready", "order_dispatched",
  "order_delivered", "order_cancelled", "order_invoice",
];

export function parseTemplateVariables(raw: string): string[] {
  return raw.split(";").map((value) => value.trim()).filter(Boolean);
}
