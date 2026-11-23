import { useRef, useState } from "react";
import { Btn, Card, Field, PageHeading, inputCls } from "./bits";
import { AppearanceSettingsPanel } from "./appearance-settings";
import { TerminalSettingsPanel } from "./terminal-settings";
import { phpApi } from "@/lib/api/php-client";
import { usePos } from "@/lib/pos/store";
import type { PosState, Settings } from "@/lib/pos/model";
import { readLegacyBrowserPosState } from "./pos-data";

export function SettingsScreen({ saveRecord }: { saveRecord: <T extends { id: string | number }>(resource: string, item: T, commit: () => void) => Promise<boolean> }) {
  const settings = usePos((s) => s.settings);
  const patchSettings = usePos((s) => s.patchSettings);
  const [note, setNote] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  function persistSettings() {
    const current = usePos.getState().settings;
    void saveRecord("settings", { id: "main", ...current, smsUser: "", smsKey: "", smsFrom: "" }, () => {});
  }

  async function importLocalDataToMysql() {
    if (!window.confirm("داده‌های فعلی همین دستگاه (به‌جز تاریخچه سفارش‌ها) فقط یک‌بار به دیتابیس خالی منتقل می‌شوند. ادامه می‌دهید؟")) return;
    setImporting(true);
    setNote("");
    try {
      const current = usePos.getState();
      const currentHasData = [current.categories, current.products, current.ingredients, current.customers, current.discounts, current.orders, current.expenses, current.templates]
        .some((items) => items.length > 0);
      const legacy = currentHasData ? null : readLegacyBrowserPosState();
      const state: PosState = { ...current, ...(legacy ?? {}) };
      const hasData = [state.categories, state.products, state.ingredients, state.customers, state.discounts, state.orders, state.expenses, state.templates]
        .some((items) => items.length > 0);
      if (!hasData) throw new Error("داده قدیمی یا پشتیبان قابل انتقالی در این دستگاه پیدا نشد.");
      const result = await phpApi.importLegacyData({
        nextOrder: state.nextOrder,
        data: {
          categories: state.categories,
          products: state.products,
          ingredients: state.ingredients,
          customers: state.customers,
          discounts: state.discounts,
          expenses: state.expenses,
          templates: state.templates,
          settings: [{ id: "main", ...state.settings, smsUser: "", smsKey: "", smsFrom: "" }],
        },
      });
      const total = Object.values(result.counts).reduce((sum, count) => sum + count, 0);
      if (legacy) window.localStorage.removeItem("grillcash-v1");
      setNote(`${total.toLocaleString("fa-IR")} رکورد به MySQL منتقل شد؛ صفحه برای بارگذاری داده مرکزی تازه می‌شود.`);
      window.location.reload();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "انتقال داده انجام نشد");
    } finally {
      setImporting(false);
    }
  }
  async function restoreBackupFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setNote("حجم فایل پشتیبان بیشتر از ۸ مگابایت است.");
      return;
    }
    if (!window.confirm("هشدار: بازیابی فقط روی دیتابیس عملیاتی خالی مجاز است. فایل باید متعلق به 3Food POS و قابل اعتماد باشد. ادامه می‌دهید؟")) return;
    setRestoring(true);
    setNote("");
    try {
      const backup = JSON.parse(await file.text()) as Record<string, unknown>;
      const result = await phpApi.restoreBackup(backup);
      const counts = result.restored;
      setNote(`بازیابی انجام شد: ${counts.records} رکورد، ${counts.orders} سفارش و دفترهای تراکنشی. صفحه تازه‌سازی می‌شود.`);
      window.location.reload();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "بازیابی انجام نشد؛ دیتابیس تغییر نکرد.");
    } finally {
      setRestoring(false);
      if (restoreInput.current) restoreInput.current.value = "";
    }
  }

  async function download() {
    setExporting(true);
    setNote("");
    try {
      const result = await phpApi.exportBackup();
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `3food-pos-mysql-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote("نسخه پشتیبان کامل از MySQL آماده شد.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "تهیه نسخه پشتیبان از MySQL انجام نشد");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-4">
      <PageHeading title="تنظیمات فروشگاه" description="ظاهر سامانه، اطلاعات فروشگاه، فیش‌پرینتر و پشتیبان‌گیری را پیکربندی کنید." />
      <AppearanceSettingsPanel />
      <TerminalSettingsPanel />
      <Card className="grid gap-2 sm:grid-cols-2">
        <Field label="نام فروشگاه"><input className={inputCls} value={settings.shopName} onChange={(e) => patchSettings({ shopName: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="تلفن"><input className={inputCls} value={settings.phone} onChange={(e) => patchSettings({ phone: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="آدرس"><input className={inputCls} value={settings.address} onChange={(e) => patchSettings({ address: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="مالیات درصد"><input className={inputCls} type="number" min="0" max="100" step="0.01" value={settings.taxPercent} onChange={(e) => patchSettings({ taxPercent: Number(e.target.value) })} onBlur={persistSettings} /></Field>
        <Field label="آستانه هشدار تأخیر سفارش (دقیقه)">
          <input className={inputCls} type="number" min="1" max="240" value={settings.orderDelayMinutes ?? 20} onChange={(e) => patchSettings({ orderDelayMinutes: Math.min(240, Math.max(1, Number(e.target.value) || 1)) })} onBlur={persistSettings} />
        </Field>
        <Field label="سیاست فروش با موجودی ناکافی">
          <select className={inputCls} value={settings.stockPolicy ?? "warn_and_allow"} onChange={(e) => patchSettings({ stockPolicy: e.target.value as Settings["stockPolicy"] })} onBlur={persistSettings}>
            <option value="block">جلوگیری از ثبت سفارش</option>
            <option value="warn_and_allow">نمایش هشدار و اجازه ادامه فروش</option>
            <option value="allow_negative">اجازه موجودی منفی بدون نمایش هشدار</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.taxEnabled !== false} onChange={(e) => { const value = e.target.checked; patchSettings({ taxEnabled: value }); const current = usePos.getState().settings; void saveRecord("settings", { id: "main", ...current, taxEnabled: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />محاسبه مالیات فعال باشد</label>
        <Field label="هر چند تومان یک امتیاز"><input className={inputCls} type="number" value={settings.pointsPerToman} onChange={(e) => patchSettings({ pointsPerToman: Number(e.target.value) })} onBlur={persistSettings} /></Field>
        <Field label="ارزش هر امتیاز"><input className={inputCls} type="number" value={settings.tomanPerPoint} onChange={(e) => patchSettings({ tomanPerPoint: Number(e.target.value) })} onBlur={persistSettings} /></Field>
        <Field label="آستانه عضویت نقره (امتیاز)"><input className={inputCls} type="number" min="1" value={settings.loyaltySilverPoints??500} onChange={e=>patchSettings({loyaltySilverPoints:Math.max(1,Number(e.target.value))})} onBlur={persistSettings}/></Field>
        <Field label="تخفیف نقره (%)"><input className={inputCls} type="number" min="0" max="100" value={settings.loyaltySilverDiscount??3} onChange={e=>patchSettings({loyaltySilverDiscount:Math.min(100,Math.max(0,Number(e.target.value)))})} onBlur={persistSettings}/></Field>
        <Field label="آستانه عضویت طلا (امتیاز)"><input className={inputCls} type="number" min={(settings.loyaltySilverPoints??500)+1} value={settings.loyaltyGoldPoints??1500} onChange={e=>patchSettings({loyaltyGoldPoints:Math.max((settings.loyaltySilverPoints??500)+1,Number(e.target.value))})} onBlur={persistSettings}/></Field>
        <Field label="تخفیف طلا (%)"><input className={inputCls} type="number" min="0" max="100" value={settings.loyaltyGoldDiscount??5} onChange={e=>patchSettings({loyaltyGoldDiscount:Math.min(100,Math.max(0,Number(e.target.value)))})} onBlur={persistSettings}/></Field>
        <Field label="آستانه عضویت پلاتین (امتیاز)"><input className={inputCls} type="number" min={(settings.loyaltyGoldPoints??1500)+1} value={settings.loyaltyPlatinumPoints??4000} onChange={e=>patchSettings({loyaltyPlatinumPoints:Math.max((settings.loyaltyGoldPoints??1500)+1,Number(e.target.value))})} onBlur={persistSettings}/></Field>
        <Field label="تخفیف پلاتین (%)"><input className={inputCls} type="number" min="0" max="100" value={settings.loyaltyPlatinumDiscount??8} onChange={e=>patchSettings({loyaltyPlatinumDiscount:Math.min(100,Math.max(0,Number(e.target.value)))})} onBlur={persistSettings}/></Field>
        <Field label="عرض کاغذ">
          <select className={inputCls} value={settings.paperWidth} onChange={(e) => patchSettings({ paperWidth: Number(e.target.value) as 58 | 80 })} onBlur={persistSettings}>
            <option value={58}>۵۸ میلی‌متر</option><option value={80}>۸۰ میلی‌متر</option>
          </select>
        </Field>
        <Field label="بالای فیش"><input className={inputCls} value={settings.headerNote} onChange={(e) => patchSettings({ headerNote: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="پایین فیش"><input className={inputCls} value={settings.footerNote} onChange={(e) => patchSettings({ footerNote: e.target.value })} onBlur={persistSettings} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.autoPrint} onChange={(e) => { const value = e.target.checked; patchSettings({ autoPrint: value }); const current = usePos.getState().settings; void saveRecord("settings", { id: "main", ...current, autoPrint: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />چاپ خودکار</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.printCustomer} onChange={(e) => { const value = e.target.checked; patchSettings({ printCustomer: value }); const current = usePos.getState().settings; void saveRecord("settings", { id: "main", ...current, printCustomer: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />فیش مشتری</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.printKitchen} onChange={(e) => { const value = e.target.checked; patchSettings({ printKitchen: value }); const current = usePos.getState().settings; void saveRecord("settings", { id: "main", ...current, printKitchen: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />فیش آشپزخانه</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.invoiceSmsEnabledDefault ?? false} onChange={(e) => { const value=e.target.checked; patchSettings({invoiceSmsEnabledDefault:value}); const current=usePos.getState().settings; void saveRecord("settings",{id:"main",...current,invoiceSmsEnabledDefault:value,smsUser:"",smsKey:"",smsFrom:""},()=>{}); }}/>ارسال پیامک ریز فاکتور به‌صورت پیش‌فرض فعال باشد</label>
      </Card>
      <Card>
        <p className="mb-2 text-sm text-muted">نسخه پشتیبان از داده‌های مرکزی MySQL ساخته می‌شود و شامل تاریخچه سفارش‌ها و دفترهای تراکنشی است؛ کلید پیامک داخل فایل قرار نمی‌گیرد.</p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void download()} disabled={exporting}>{exporting ? "در حال تهیه..." : "دانلود پشتیبان MySQL"}</Btn>
          <Btn tone="ghost" onClick={() => void importLocalDataToMysql()} disabled={importing}>{importing ? "در حال انتقال..." : "انتقال داده این دستگاه به MySQL"}</Btn>
          <Btn tone="ghost" onClick={() => restoreInput.current?.click()} disabled={restoring}>{restoring ? "در حال بازیابی..." : "بازیابی پشتیبان MySQL"}</Btn>
          <input ref={restoreInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restoreBackupFile(file); }} />
          <p className="self-center text-xs text-muted">بازیابی فقط روی دیتابیس POS خالی انجام می‌شود؛ اطلاعات کاربران و ورود حفظ می‌شوند.</p>
        </div>
        {note ? <p className="mt-2 text-sm">{note}</p> : null}
      </Card>
    </div>
  );
}
