import { useState } from "react";
import { Btn, Card, Empty, Field, PageHeading, inputCls } from "./bits";
import { money, TIER_LABEL, tierOf, uid, type Role } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";
import { normalizeIranPhone } from "@/lib/pos/formatters";

type CustomersScreenProps = {
  role: Role;
  saveRecord: <T extends { id: string | number }>(resource: string, item: T, commit: () => void) => Promise<boolean>;
};

export function CustomersScreen({ role, saveRecord }: CustomersScreenProps) {
  const customers = usePos((s) => s.customers);
  const settings = usePos((s) => s.settings);
  const patchSettings = usePos((s) => s.patchSettings);
  const orders = usePos((s) => s.orders);
  const saveCustomer = usePos((s) => s.saveCustomer);
  const [q, setQ] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", birthday: "", smsConsent: false });
  const normalizedQuery=normalizeIranPhone(q);
  const list = customers.filter((c) => c.name.includes(q) || (normalizedQuery.length>0 && normalizeIranPhone(c.phone).includes(normalizedQuery)));
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const selectedOrders = selectedCustomer
    ? orders.filter((order) => order.customerId === selectedCustomer.id || normalizeIranPhone(order.customerPhone) === normalizeIranPhone(selectedCustomer.phone))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];
  return (
    <div className="space-y-3">
      <PageHeading title="باشگاه مشتریان" description="اعضا، سوابق خرید و امتیازهای وفاداری را مدیریت کنید." />
      <p className="text-sm text-muted">سطوح عضویت: نقره از {Number(settings.loyaltySilverPoints??500).toLocaleString("fa-IR")} امتیاز ({settings.loyaltySilverDiscount??3}٪)، طلا از {Number(settings.loyaltyGoldPoints??1500).toLocaleString("fa-IR")} ({settings.loyaltyGoldDiscount??5}٪)، پلاتین از {Number(settings.loyaltyPlatinumPoints??4000).toLocaleString("fa-IR")} ({settings.loyaltyPlatinumDiscount??8}٪).</p>
      {role === "manager" ? (
        <Card>
          <h3 className="mb-2 font-semibold">تنظیمات امتیازدهی باشگاه</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="به‌ازای هر چند تومان خرید، یک امتیاز؟">
              <input className={inputCls} type="number" min="1" value={settings.pointsPerToman} onChange={(e) => patchSettings({ pointsPerToman: Math.max(1, Number(e.target.value)) })} onBlur={() => {
                const current = usePos.getState().settings;
                void saveRecord("settings", { id: "main", ...current, smsUser: "", smsKey: "", smsFrom: "" }, () => {});
              }} />
            </Field>
            <Field label="ارزش هر امتیاز به تومان">
              <input className={inputCls} type="number" min="1" value={settings.tomanPerPoint} onChange={(e) => patchSettings({ tomanPerPoint: Math.max(1, Number(e.target.value)) })} onBlur={() => {
                const current = usePos.getState().settings;
                void saveRecord("settings", { id: "main", ...current, smsUser: "", smsKey: "", smsFrom: "" }, () => {});
              }} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">این نرخ‌ها برای تمام صندوق‌ها و کاربران یکسان اعمال می‌شود.</p>
        </Card>
      ) : null}
      <Card>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          if (!form.phone) return;
          const item = { id: uid("cu"), name: form.name || "بدون نام", phone: form.phone, points: 0, birthday: form.birthday, smsConsent: form.smsConsent, totalSpent: 0, visits: 0, createdAt: new Date().toISOString() };
          void saveRecord("customers", item, () => saveCustomer(item)).then((ok) => { if (ok) setForm({ name: "", phone: "", birthday: "", smsConsent: false }); });
        }}>
          <input className={inputCls} placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="موبایل" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={inputCls} type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.smsConsent} onChange={e=>setForm({...form,smsConsent:e.target.checked})}/>رضایت دریافت پیامک تبلیغاتی</label>
          <Btn type="submit">عضویت</Btn>
        </form>
      </Card>
      <input className={inputCls} placeholder="جستجو با شماره موبایل یا نام خانوادگی" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <div><p className="font-bold">{c.name}</p><p className="text-sm text-muted">{c.phone}</p></div>
            <p className="text-sm">{TIER_LABEL[tierOf(c.points,settings)]} — {c.points.toLocaleString("fa-IR")} امتیاز — {money(c.totalSpent)}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={c.smsConsent === true} onChange={e=>{const updated={...c,smsConsent:e.target.checked};void saveRecord("customers",updated,()=>saveCustomer(updated));}}/>رضایت پیامک تبلیغاتی</label>
            <p className="text-xs text-muted">{orders.filter((o) => o.customerId === c.id || normalizeIranPhone(o.customerPhone) === normalizeIranPhone(c.phone)).length.toLocaleString("fa-IR")} سفارش ثبت‌شده</p>
            <Btn tone="ghost" onClick={() => setSelectedCustomerId(selectedCustomerId === c.id ? null : c.id)}>{selectedCustomerId === c.id ? "بستن سوابق" : "گزارش خریدها"}</Btn>
          </div>
        </Card>
      ))}
      {selectedCustomer ? (
        <Card>
          <h3 className="font-bold">سوابق خرید {selectedCustomer.name}</h3>
          <p className="mt-1 text-sm text-muted">موبایل: {selectedCustomer.phone} — مجموع خرید: {money(selectedCustomer.totalSpent)} — {selectedOrders.length.toLocaleString("fa-IR")} سفارش</p>
          {selectedOrders.length ? (
            <div className="mt-3 space-y-2">
              {selectedOrders.map((order) => (
                <div key={order.id} className="flex flex-wrap justify-between gap-2 border-t border-line pt-2 text-sm">
                  <span>سفارش {order.number.toLocaleString("fa-IR")} — {new Date(order.createdAt).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"})}</span>
                  <span className="font-semibold">{money(order.total)}{order.status === "cancelled" ? " — لغو شده" : ""}</span>
                </div>
              ))}
            </div>
          ) : <Empty text="سفارشی برای این مشتری ثبت نشده است." />}
        </Card>
      ) : null}
    </div>
  );
}


const REPORT_INITIAL_TO = tehranDate();
const REPORT_INITIAL_FROM = tehranDate(Date.now() - 6 * 86400000);

