export function normalizeIranPhone(value: string) {
  let digits = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[^0-9+]/g, "");
  if (digits.startsWith("+98")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("0098")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("98") && digits.length === 12) digits = "0" + digits.slice(2);
  return digits.replace(/\D/g, "");
}

export function tehranDate(value: Date | string | number = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  return days > 0
    ? `${days.toLocaleString("fa-IR")} روز و ${hours.toLocaleString("fa-IR")} ساعت`
    : hours > 0
      ? `${hours.toLocaleString("fa-IR")} ساعت و ${minutes.toLocaleString("fa-IR")} دقیقه`
      : `${minutes.toLocaleString("fa-IR")} دقیقه`;
}
