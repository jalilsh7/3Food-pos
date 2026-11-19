import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Boxes, ClipboardList, PackagePlus, Search } from "lucide-react";
import { Button, Notice, SelectField, StatusBadge, Surface, TextField } from "../../shared/ui";
import "./inventory.css";

type StockItem = { id: number; name: string; category: string; unit: string; location: string; quantity: number; minimum: number };
type StockMovement = { id: number; itemName: string; type: "in" | "out" | "adjust"; quantity: number; unit: string; reason: string; location: string; time: string };
const initialStock: StockItem[] = [
  { id: 1, name: "گوشت برگر", category: "پروتئین", unit: "کیلوگرم", location: "انبار اصلی", quantity: 8.5, minimum: 5 },
  { id: 2, name: "پنیر ورقه‌ای", category: "لبنیات", unit: "بسته", location: "انبار اصلی", quantity: 3, minimum: 6 },
  { id: 3, name: "قارچ", category: "سبزیجات", unit: "کیلوگرم", location: "یخچال", quantity: 2.4, minimum: 3 },
  { id: 4, name: "سیب‌زمینی", category: "سبزیجات", unit: "کیلوگرم", location: "انبار اصلی", quantity: 24, minimum: 8 },
  { id: 5, name: "دانه قهوه", category: "نوشیدنی", unit: "کیلوگرم", location: "قفسه کافه", quantity: 4.2, minimum: 2 },
  { id: 6, name: "شیر", category: "لبنیات", unit: "لیتر", location: "یخچال", quantity: 1.5, minimum: 5 },
  { id: 7, name: "ظرف بیرون‌بر", category: "بسته‌بندی", unit: "عدد", location: "انبار اصلی", quantity: 120, minimum: 40 },
];
const initialMovements: StockMovement[] = [
  { id: 1, itemName: "گوشت برگر", type: "in", quantity: 5, unit: "کیلوگرم", reason: "رسید خرید نمونه", location: "انبار اصلی", time: "۱۴:۲۰" },
  { id: 2, itemName: "شیر", type: "out", quantity: 2, unit: "لیتر", reason: "مصرف تولید نمونه", location: "یخچال", time: "۱۳:۵۵" },
  { id: 3, itemName: "پنیر ورقه‌ای", type: "adjust", quantity: 1, unit: "بسته", reason: "اصلاح شمارش نمونه", location: "انبار اصلی", time: "۱۲:۴۰" },
];
const money = (value: number) => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value);
const parseQuantity = (value: string) => {
  const normalized = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[،,٬\s]/g, "").replace(/[^0-9.]/g, "");
  return normalized ? Number(normalized) : 0;
};

export function InventoryWorkspace() {
  const [stock, setStock] = useState(initialStock);
  const [movements, setMovements] = useState(initialMovements);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("همه");
  const [lowOnly, setLowOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(2);
  const [showMovement, setShowMovement] = useState(false);
  const [movementType, setMovementType] = useState("in");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const locations = ["همه", ...Array.from(new Set(stock.map((item) => item.location)))];
  const visible = useMemo(() => stock.filter((item) =>
    (location === "همه" || item.location === location) &&
    (!lowOnly || item.quantity <= item.minimum) &&
    item.name.toLocaleLowerCase("fa-IR").includes(query.trim().toLocaleLowerCase("fa-IR"))
  ), [stock, location, lowOnly, query]);
  const selected = stock.find((item) => item.id === selectedId) ?? null;
  const lowCount = stock.filter((item) => item.quantity <= item.minimum).length;

  function saveMovement() {
    if (!selected) return;
    const quantity = parseQuantity(movementQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !movementReason.trim()) return;
    if (movementType === "out" && quantity > selected.quantity) return;
    setStock((current) => current.map((item) => item.id !== selected.id ? item : {
      ...item,
      quantity: movementType === "in" ? item.quantity + quantity : movementType === "out" ? item.quantity - quantity : quantity,
    }));
    setMovements((current) => [{ id: Date.now(), itemName: selected.name, type: movementType as StockMovement["type"], quantity, unit: selected.unit, reason: movementReason.trim(), location: selected.location, time: "اکنون · نمونه" }, ...current]);
    setShowMovement(false); setMovementQuantity(""); setMovementReason("");
  }

  return (
    <div className="page-stack inventory-workspace">
      <div className="inventory-heading"><div><span className="ui-eyebrow">INVENTORY CONTROL</span><h1>مواد اولیه و انبار</h1><p>نمایش موجودی، هشدار حداقل و گردش نمونه کالا</p></div><Button variant="primary" onClick={() => setShowMovement((value) => !value)}><PackagePlus size={15} /> ثبت گردش نمونه</Button></div>
      <Notice variant="warning">اطلاعات این بخش نمونه است. رسید، مصرف و اصلاح موجودی فقط در همین صفحه شبیه‌سازی می‌شود؛ هیچ سند انبار یا اثر مالی/رسپی واقعی ثبت نمی‌شود.</Notice>
      <div className="inventory-metrics">
        <Surface padding="sm"><span>اقلام انبار</span><strong>{money(stock.length)}</strong></Surface>
        <Surface padding="sm"><span>نیازمند تأمین</span><strong className="is-low">{money(lowCount)}</strong></Surface>
        <Surface padding="sm"><span>محل‌های نگهداری</span><strong>{money(locations.length - 1)}</strong></Surface>
      </div>
      {showMovement ? <Surface padding="md" className="inventory-movement-form">
        <div className="inventory-form-heading"><strong>گردش موجودی برای {selected?.name ?? "قلم انتخاب‌شده"}</strong><Button size="sm" variant="ghost" onClick={() => setShowMovement(false)}>بستن</Button></div>
        <div className="inventory-form-grid"><SelectField label="نوع گردش" value={movementType} onChange={(event) => setMovementType(event.target.value)} options={[{ value: "in", label: "ورود / رسید" }, { value: "out", label: "خروج / مصرف" }, { value: "adjust", label: "اصلاح شمارش" }]} /><TextField label={movementType === "adjust" ? "موجودی نهایی" : "مقدار"} value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} placeholder="مقدار به واحد قلم" /><TextField label="علت / مرجع" value={movementReason} onChange={(event) => setMovementReason(event.target.value)} placeholder="مثلاً رسید خرید یا مصرف تولید" /></div>
        <div className="inventory-form-footer"><span>واحد: {selected?.unit ?? "—"} · ارقام فارسی و انگلیسی پذیرفته می‌شوند.</span><Button variant="primary" onClick={saveMovement} disabled={!selected || !movementQuantity.trim() || !movementReason.trim()}>ثبت در نمونه</Button></div>
      </Surface> : null}
      <div className="inventory-layout">
        <Surface padding="md" className="inventory-stock-panel">
          <div className="inventory-panel-heading"><div><h2><Boxes size={17} /> موجودی اقلام</h2><p>{money(visible.length)} قلم مطابق فیلتر</p></div><button type="button" className={lowOnly ? "inventory-low-filter is-active" : "inventory-low-filter"} onClick={() => setLowOnly((value) => !value)} aria-pressed={lowOnly}>فقط کم‌موجودها</button></div>
          <label className="inventory-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی ماده اولیه" /></label>
          <div className="inventory-locations">{locations.map((item) => <button type="button" key={item} className={location === item ? "is-active" : ""} onClick={() => setLocation(item)}>{item}</button>)}</div>
          <div className="inventory-stock-list">{visible.map((item) => {
            const low = item.quantity <= item.minimum;
            return <button type="button" key={item.id} className={selectedId === item.id ? "inventory-stock-row is-selected" : "inventory-stock-row"} onClick={() => setSelectedId(item.id)}>
              <span className="inventory-stock-copy"><strong>{item.name}</strong><small>{item.category} · {item.location}</small></span><span className="inventory-stock-amount"><b>{money(item.quantity)}</b><small>{item.unit}</small></span><StatusBadge variant={low ? "danger" : "success"}>{low ? "کمبود" : "عادی"}</StatusBadge>
            </button>;
          })}</div>
          {!visible.length ? <div className="inventory-empty">موردی با این فیلتر پیدا نشد.</div> : null}
        </Surface>
        <Surface padding="md" className="inventory-detail-panel">
          {selected ? <>
            <div className="inventory-detail-heading"><div><span className="ui-eyebrow">STOCK DETAILS</span><h2>{selected.name}</h2><p>{selected.category} · {selected.location}</p></div><StatusBadge variant={selected.quantity <= selected.minimum ? "danger" : "success"}>{selected.quantity <= selected.minimum ? "زیر حداقل" : "موجودی عادی"}</StatusBadge></div>
            <div className="inventory-balance"><span>موجودی فعلی</span><strong>{money(selected.quantity)} <small>{selected.unit}</small></strong></div>
            <div className="inventory-threshold"><span>حداقل موجودی تعریف‌شده</span><b>{money(selected.minimum)} {selected.unit}</b></div>
            <div className="inventory-history-heading"><strong><ClipboardList size={15} /> گردش‌های اخیر نمونه</strong><span>{money(movements.filter((item) => item.itemName === selected.name).length)} مورد</span></div>
            <div className="inventory-history">{movements.filter((item) => item.itemName === selected.name).map((item) => <div className="inventory-movement-row" key={item.id}><span className={`inventory-movement-icon is-${item.type}`}>{item.type === "in" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><div><strong>{item.reason}</strong><small>{item.location} · {item.time}</small></div><b>{item.type === "in" ? "+" : item.type === "out" ? "−" : "="}{money(item.quantity)} {item.unit}</b></div>)}</div>
          </> : <div className="inventory-empty">یک قلم را از فهرست انتخاب کنید.</div>}
        </Surface>
      </div>
    </div>
  );
}
