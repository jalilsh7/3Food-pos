import { useEffect, useMemo, useState } from "react";
import { Activity, Boxes, MapPin, Package, RefreshCw, Search } from "lucide-react";
import {
  ApiError,
  getInventoryBalances,
  getInventoryLedger,
  getInventoryLocations,
  getInventoryStockItems,
  type InventoryBalance,
  type InventoryLedgerEntry,
  type InventoryLocation,
  type InventoryStockItem,
} from "../../shared/api/client";
import { Button, Notice, Surface } from "../../shared/ui";
import "./inventory.css";

const numberFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 3 });
const quantity = (value: string | number) => numberFormat.format(Number(value) || 0);
const dateTime = (value: string) => {
  const date = new Date(value.includes("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(date);
};
const movementLabel: Record<string, string> = {
  purchase_receipt: "رسید خرید",
  adjustment_in: "تعدیل افزایشی",
  adjustment_out: "تعدیل کاهشی",
  consumption: "مصرف",
  waste: "ضایعات",
  transfer_in: "انتقال ورودی",
  transfer_out: "انتقال خروجی",
  return: "برگشت",
};

export function InventoryWorkspace() {
  const [items, setItems] = useState<InventoryStockItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [ledger, setLedger] = useState<InventoryLedgerEntry[]>([]);
  const [query, setQuery] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [stockItems, stockLocations, stockBalances, entries] = await Promise.all([
        getInventoryStockItems(),
        getInventoryLocations(),
        getInventoryBalances({ limit: 200 }),
        getInventoryLedger({ limit: 50 }),
      ]);
      setItems(stockItems);
      setLocations(stockLocations);
      setBalances(stockBalances);
      setLedger(entries);
      setSelectedId((current) => stockItems.some((item) => item.id === current) ? current : stockItems[0]?.id ?? "");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "دریافت اطلاعات واقعی انبار انجام نشد.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa-IR");
    return items.filter((item) => {
      const matchesQuery = !normalized || `${item.name} ${item.code}`.toLocaleLowerCase("fa-IR").includes(normalized);
      const matchesLocation = locationId === "all" || balances.some((balance) => balance.stock_item_id === item.id && balance.location_id === locationId);
      return matchesQuery && matchesLocation;
    });
  }, [items, query, locationId, balances]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedBalances = balances.filter((balance) => balance.stock_item_id === selectedId && (locationId === "all" || balance.location_id === locationId));
  const selectedLedger = ledger.filter((entry) => entry.stock_item_id === selectedId && (locationId === "all" || entry.location_id === locationId));
  const totals = balances.reduce((result, balance) => ({
    onHand: result.onHand + Number(balance.quantity_on_hand),
    reserved: result.reserved + Number(balance.quantity_reserved),
    available: result.available + Number(balance.quantity_available),
  }), { onHand: 0, reserved: 0, available: 0 });

  return (
    <div className="page-stack inventory-workspace">
      <div className="inventory-heading">
        <div>
          <span className="ui-eyebrow">INVENTORY CONTROL</span>
          <h1>مواد اولیه و انبار</h1>
          <p>مانده موجودی و گردش ثبت‌شده در کسب‌وکار و شعبه فعال</p>
        </div>
        <Button variant="secondary" onClick={() => void loadData(true)} disabled={loading || refreshing}>
          <RefreshCw size={15} /> {refreshing ? "در حال به‌روزرسانی..." : "به‌روزرسانی"}
        </Button>
      </div>

      <Notice variant="info">اطلاعات این صفحه مستقیماً از API انبار و دیتابیس دریافت می‌شود. ثبت یا تغییر موجودی فقط از طریق اسناد رسمی انبار انجام می‌شود.</Notice>
      {error ? <Notice variant="warning">{error}</Notice> : null}

      <div className="inventory-metrics">
        <Surface padding="sm"><span>اقلام فعال</span><strong>{loading ? "—" : quantity(items.length)}</strong></Surface>
        <Surface padding="sm"><span>موجودی فیزیکی (جمع واحدها)</span><strong>{loading ? "—" : quantity(totals.onHand)}</strong></Surface>
        <Surface padding="sm"><span>موجودی قابل استفاده</span><strong>{loading ? "—" : quantity(totals.available)}</strong></Surface>
      </div>

      <div className="inventory-layout">
        <Surface padding="md" className="inventory-stock-panel">
          <div className="inventory-panel-heading">
            <div><h2><Boxes size={17} /> اقلام انبار</h2><p>{quantity(filteredItems.length)} قلم</p></div>
          </div>
          <label className="inventory-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام یا کد کالا" /></label>
          <div className="inventory-locations">
            <button type="button" className={locationId === "all" ? "is-active" : ""} onClick={() => setLocationId("all")}>همه انبارک‌ها</button>
            {locations.map((location) => <button type="button" key={location.id} className={locationId === location.id ? "is-active" : ""} onClick={() => setLocationId(location.id)}>{location.name}</button>)}
          </div>
          {loading ? <div className="inventory-empty">در حال دریافت موجودی از سرور...</div> : (
            <div className="inventory-stock-list">
              {filteredItems.map((item) => {
                const rows = balances.filter((balance) => balance.stock_item_id === item.id && (locationId === "all" || balance.location_id === locationId));
                const onHand = rows.reduce((sum, row) => sum + Number(row.quantity_on_hand), 0);
                const available = rows.reduce((sum, row) => sum + Number(row.quantity_available), 0);
                return (
                  <button type="button" key={item.id} className={selectedId === item.id ? "inventory-stock-row is-selected" : "inventory-stock-row"} onClick={() => setSelectedId(item.id)}>
                    <span className="inventory-stock-copy"><strong>{item.name}</strong><small>{item.code} · {item.base_unit.name}</small></span>
                    <span className="inventory-stock-amount"><b>{quantity(onHand)}</b><small>{item.base_unit.code} · قابل استفاده {quantity(available)}</small></span>
                  </button>
                );
              })}
              {!filteredItems.length ? <div className="inventory-empty">{error ? "اطلاعات قابل نمایش نیست." : "قلمی با این جست‌وجو یا انبارک پیدا نشد."}</div> : null}
            </div>
          )}
        </Surface>

        <Surface padding="md" className="inventory-detail-panel">
          {selected ? (
            <>
              <div className="inventory-detail-heading"><div><span className="ui-eyebrow">LIVE STOCK DETAILS</span><h2>{selected.name}</h2><p>{selected.code} · {selected.base_unit.name}</p></div><Package size={20} /></div>
              <div className="inventory-balance"><span>موجودی در انبارک انتخاب‌شده</span><strong>{quantity(selectedBalances.reduce((sum, row) => sum + Number(row.quantity_on_hand), 0))} <small>{selected.base_unit.code}</small></strong></div>
              <div className="inventory-threshold"><span>رزروشده</span><b>{quantity(selectedBalances.reduce((sum, row) => sum + Number(row.quantity_reserved), 0))} {selected.base_unit.code}</b></div>
              <div className="inventory-threshold"><span>قابل استفاده</span><b>{quantity(selectedBalances.reduce((sum, row) => sum + Number(row.quantity_available), 0))} {selected.base_unit.code}</b></div>
              <div className="inventory-history-heading"><strong><Activity size={15} /> گردش‌های ثبت‌شده</strong><span>{quantity(selectedLedger.length)} مورد اخیر</span></div>
              <div className="inventory-history">
                {selectedLedger.map((entry, index) => (
                  <div className="inventory-movement-row" key={`${entry.document_id ?? "ledger"}-${entry.created_at}-${index}`}>
                    <span className={Number(entry.quantity_delta) >= 0 ? "inventory-movement-icon is-in" : "inventory-movement-icon is-out"}><Activity size={15} /></span>
                    <div><strong>{movementLabel[entry.movement_type] ?? entry.movement_type}</strong><small>{entry.location_name} · {dateTime(entry.created_at)}{entry.document_no ? ` · سند ${entry.document_no}` : ""}</small>{entry.note ? <small>{entry.note}</small> : null}</div>
                    <b>{Number(entry.quantity_delta) > 0 ? "+" : ""}{quantity(entry.quantity_delta)} {entry.base_unit_code}</b>
                  </div>
                ))}
                {!selectedLedger.length ? <div className="inventory-empty">برای این قلم در بازه اخیر گردش ثبت‌شده‌ای وجود ندارد.</div> : null}
              </div>
            </>
          ) : <div className="inventory-empty">{loading ? "در حال بارگذاری..." : "یک قلم را از فهرست انتخاب کنید."}</div>}
          {selectedBalances.length > 1 ? <div className="inventory-location-breakdown"><strong><MapPin size={14} /> موجودی به تفکیک انبارک</strong>{selectedBalances.map((balance) => <div key={balance.location_id}><span>{balance.location_name}</span><b>{quantity(balance.quantity_on_hand)} {balance.base_unit_code}</b></div>)}</div> : null}
        </Surface>
      </div>
    </div>
  );
}
