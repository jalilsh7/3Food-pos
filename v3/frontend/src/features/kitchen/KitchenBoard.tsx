import { useMemo, useState } from "react";
import { ChefHat, Clock3, Flame, RefreshCw } from "lucide-react";
import { Button, Notice, StatusBadge, Surface } from "../../shared/ui";
import "./kitchen.css";

type ItemState = "queued" | "preparing" | "ready";
type KitchenItem = { id: string; name: string; quantity: number; station: string; options?: string[]; note?: string; state: ItemState };
type KitchenTicket = { id: string; channel: string; orderType: string; table?: string; time: string; elapsed: string; priority: "normal" | "urgent"; items: KitchenItem[] };

const initialTickets: KitchenTicket[] = [
  { id: "D-1048", channel: "صندوق", orderType: "سرو داخل", table: "میز ۴", time: "۱۴:۳۲", elapsed: "۶ دقیقه", priority: "urgent", items: [
    { id: "a1", name: "برگر کلاسیک", quantity: 1, station: "گریل", options: ["دوبل", "پنیر اضافه"], note: "سس جداگانه", state: "preparing" },
    { id: "a2", name: "سیب‌زمینی", quantity: 1, station: "سرخ‌کن", state: "queued" },
  ] },
  { id: "D-1047", channel: "تلفنی", orderType: "بیرون‌بر", time: "۱۴:۲۶", elapsed: "۱۲ دقیقه", priority: "normal", items: [
    { id: "b1", name: "پیتزا مخصوص", quantity: 2, station: "فر", options: ["دو نفره"], state: "preparing" },
  ] },
  { id: "D-1046", channel: "صندوق", orderType: "ارسال", time: "۱۴:۱۸", elapsed: "۲۰ دقیقه", priority: "normal", items: [
    { id: "c1", name: "ساندویچ مرغ", quantity: 1, station: "گریل", state: "ready" },
    { id: "c2", name: "نوشابه", quantity: 1, station: "نوشیدنی", state: "ready" },
  ] },
  { id: "D-1043", channel: "تلفنی", orderType: "بیرون‌بر", time: "۱۳:۴۰", elapsed: "۵۸ دقیقه", priority: "urgent", items: [
    { id: "d1", name: "برگر کلاسیک", quantity: 1, station: "گریل", state: "queued" },
    { id: "d2", name: "سیب‌زمینی", quantity: 1, station: "سرخ‌کن", state: "queued" },
    { id: "d3", name: "نوشابه", quantity: 1, station: "نوشیدنی", state: "ready" },
  ] },
];

const stateLabel: Record<ItemState, string> = { queued: "در صف", preparing: "در حال آماده‌سازی", ready: "آماده" };

export function KitchenBoard() {
  const [tickets, setTickets] = useState(initialTickets);
  const [station, setStation] = useState("همه");
  const stations = ["همه", ...Array.from(new Set(initialTickets.flatMap((ticket) => ticket.items.map((item) => item.station))))];
  const visibleTickets = useMemo(() => tickets.map((ticket) => ({
    ...ticket,
    items: station === "همه" ? ticket.items : ticket.items.filter((item) => item.station === station),
  })).filter((ticket) => ticket.items.length > 0), [tickets, station]);
  const counts = {
    active: tickets.reduce((sum, ticket) => sum + ticket.items.filter((item) => item.state !== "ready").length, 0),
    ready: tickets.reduce((sum, ticket) => sum + ticket.items.filter((item) => item.state === "ready").length, 0),
    tickets: tickets.filter((ticket) => ticket.items.some((item) => item.state !== "ready")).length,
  };

  function advanceItem(ticketId: string, itemId: string) {
    setTickets((current) => current.map((ticket) => ticket.id !== ticketId ? ticket : {
      ...ticket,
      items: ticket.items.map((item) => item.id !== itemId ? item : {
        ...item,
        state: item.state === "queued" ? "preparing" : item.state === "preparing" ? "ready" : "ready",
      }),
    }));
  }

  function resetDemo() { setTickets(initialTickets); }

  return (
    <div className="page-stack kitchen-workspace">
      <div className="kitchen-heading">
        <div><span className="ui-eyebrow">KITCHEN DISPLAY SYSTEM</span><h1>آشپزخانه و آماده‌سازی</h1><p>صف آماده‌سازی به تفکیک سفارش و ایستگاه کاری</p></div>
        <div className="kitchen-heading-actions"><StatusBadge variant="warning">دموی تعاملی</StatusBadge><Button size="sm" variant="secondary" onClick={resetDemo}><RefreshCw size={14} /> بازنشانی نمونه</Button></div>
      </div>
      <Notice variant="warning">این برد فقط نمونه تعاملی است. تغییر وضعیت اقلام در حافظه همین صفحه انجام می‌شود و به سفارش، چاپگر یا نمایشگر آشپزخانه واقعی ارسال نمی‌شود.</Notice>
      <div className="kitchen-metrics">
        <Surface padding="sm"><span>سفارش‌های فعال</span><strong>{counts.tickets}</strong></Surface>
        <Surface padding="sm"><span>اقلام در جریان</span><strong>{counts.active}</strong></Surface>
        <Surface padding="sm"><span>اقلام آماده</span><strong>{counts.ready}</strong></Surface>
      </div>
      <div className="kitchen-toolbar">
        <div><h2><ChefHat size={18} /> صف آماده‌سازی</h2><p>فیلتر بر اساس ایستگاه</p></div>
        <div className="kitchen-stations" role="group" aria-label="فیلتر ایستگاه">
          {stations.map((item) => <button type="button" key={item} className={station === item ? "is-active" : ""} aria-pressed={station === item} onClick={() => setStation(item)}>{item}</button>)}
        </div>
      </div>
      {visibleTickets.length ? <div className="kitchen-ticket-grid">
        {visibleTickets.map((ticket) => {
          const allReady = ticket.items.every((item) => item.state === "ready");
          return <Surface padding="md" className={ticket.priority === "urgent" ? "kitchen-ticket is-urgent" : "kitchen-ticket"} key={ticket.id}>
            <div className="kitchen-ticket-head">
              <div><strong>{ticket.id}</strong><span>{ticket.channel} · {ticket.orderType}{ticket.table ? ` · ${ticket.table}` : ""}</span></div>
              <div className="kitchen-ticket-time"><Clock3 size={13} /><span>{ticket.time}</span><small>{ticket.elapsed}</small></div>
            </div>
            <div className="kitchen-ticket-flags">{ticket.priority === "urgent" ? <StatusBadge variant="danger"><Flame size={11} /> اولویت بالا</StatusBadge> : <StatusBadge variant="neutral">عادی</StatusBadge>}{allReady ? <StatusBadge variant="success">همه اقلام آماده</StatusBadge> : <StatusBadge variant="warning">در جریان</StatusBadge>}</div>
            <div className="kitchen-ticket-items">
              {ticket.items.map((item) => <article className={`kitchen-item is-${item.state}`} key={item.id}>
                <div className="kitchen-item-main"><strong>{item.name} <b>× {item.quantity}</b></strong><span>{item.station}</span></div>
                {item.options?.length ? <small>گزینه‌ها: {item.options.join("، ")}</small> : null}
                {item.note ? <small className="kitchen-item-note">یادداشت: {item.note}</small> : null}
                <div className="kitchen-item-action"><StatusBadge variant={item.state === "ready" ? "success" : item.state === "preparing" ? "warning" : "neutral"}>{stateLabel[item.state]}</StatusBadge><Button size="sm" variant={item.state === "ready" ? "ghost" : "secondary"} disabled={item.state === "ready"} onClick={() => advanceItem(ticket.id, item.id)}>{item.state === "queued" ? "شروع آماده‌سازی" : item.state === "preparing" ? "علامت‌گذاری آماده" : "تکمیل‌شده"}</Button></div>
              </article>)}
            </div>
          </Surface>;
        })}
      </div> : <Surface padding="lg"><div className="kitchen-empty"><ChefHat size={26} /><strong>در این ایستگاه موردی وجود ندارد</strong><span>ایستگاه دیگری را انتخاب کنید.</span></div></Surface>}
    </div>
  );
}
