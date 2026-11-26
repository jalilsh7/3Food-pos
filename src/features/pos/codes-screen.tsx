import { useState } from "react";
import { Btn, Card, Field, PageHeading, inputCls } from "./bits";
import { money, uid, type DiscountCode } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";

type CodesScreenProps = {
  saveRecord: <T extends { id: string | number }>(resource: string, item: T, commit: () => void) => Promise<boolean>;
  deleteRecord: (resource: string, id: string, commit: () => void) => Promise<boolean>;
};

function emptyCode(): DiscountCode {
  return { id: uid("d"), code: "", type: "percent", value: 10, maxDiscount: 50000, minOrder: 0, maxUses: 0, usedCount: 0, perCustomer: 1, startsAt: new Date().toISOString().slice(0, 10), endsAt: "2026-12-31", audience: "all" };
}

export function CodesScreen({ saveRecord, deleteRecord }: CodesScreenProps) {

  const discounts = usePos((s) => s.discounts);
  const saveDiscount = usePos((s) => s.saveDiscount);
  const removeDiscount = usePos((s) => s.removeDiscount);
  const [draft, setDraft] = useState<DiscountCode | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex justify-between"><PageHeading title="کدهای تخفیف" description="کمپین‌های تخفیف را با محدودیت و شرایط استفاده تعریف کنید." /><Btn onClick={() => setDraft(emptyCode())}>کد جدید</Btn></div>
      {discounts.map((d) => (
        <Card key={d.id} className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold">{d.code}</p>
            <p className="text-sm text-muted">{d.type === "percent" ? `${d.value}٪` : money(d.value)} — استفاده {d.usedCount.toLocaleString("fa-IR")}{d.maxUses ? ` از ${d.maxUses.toLocaleString("fa-IR")}` : " (نامحدود)"}</p>
          </div>
          <div className="flex gap-2"><Btn tone="ghost" onClick={() => setDraft(d)}>ویرایش</Btn><Btn tone="ghost" onClick={() => void deleteRecord("discounts", d.id, () => removeDiscount(d.id))}>حذف</Btn></div>
        </Card>
      ))}
      {draft ? (
        <Card>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="کد"><input className={inputCls} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="نوع"><select className={inputCls} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DiscountCode["type"] })}><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select></Field>
            <Field label="مقدار"><input className={inputCls} type="number" value={draft.value} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })} /></Field>
            <Field label="سقف تخفیف"><input className={inputCls} type="number" value={draft.maxDiscount} onChange={(e) => setDraft({ ...draft, maxDiscount: Number(e.target.value) })} /></Field>
            <Field label="حداقل سفارش"><input className={inputCls} type="number" value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: Number(e.target.value) })} /></Field>
            <Field label="سقف کل (۰ نامحدود)"><input className={inputCls} type="number" value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: Number(e.target.value) })} /></Field>
            <Field label="سقف هر مشتری"><input className={inputCls} type="number" value={draft.perCustomer} onChange={(e) => setDraft({ ...draft, perCustomer: Number(e.target.value) })} /></Field>
            <Field label="مخاطب">
              <select className={inputCls} value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as DiscountCode["audience"] })}>
                <option value="all">همه</option><option value="club">فقط باشگاه</option>
                <option value="bronze">برنز</option><option value="silver">نقره</option><option value="gold">طلا</option><option value="platinum">پلاتین</option>
              </select>
            </Field>
            <Field label="از"><input className={inputCls} type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></Field>
            <Field label="تا"><input className={inputCls} type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></Field>
          </div>
          <div className="mt-3 flex gap-2"><Btn onClick={() => { if (draft.code) void saveRecord("discounts", draft, () => saveDiscount(draft)).then((ok) => { if (ok) setDraft(null); }); }}>ذخیره</Btn><Btn tone="ghost" onClick={() => setDraft(null)}>بستن</Btn></div>
        </Card>
      ) : null}
    </div>
  );
}

