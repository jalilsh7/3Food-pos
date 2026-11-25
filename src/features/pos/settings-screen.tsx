import { useEffect, useRef, useState } from "react";
import { Btn, Card, Field, PageHeading, inputCls } from "./bits";
import { AppearanceSettingsPanel } from "./appearance-settings";
import { TerminalSettingsPanel } from "./terminal-settings";
import { phpApi } from "@/lib/api/php-client";
import { usePos } from "@/lib/pos/store";
import type { PosState, Settings } from "@/lib/pos/model";
import { readLegacyBrowserPosState } from "./pos-data";

const STATUS_OPTIONS: Array<[Settings["orderStatusEnabled"] extends Partial<Record<infer K, boolean>> | undefined ? K : never, string]> = [
  ["new", "جدید"],
  ["preparing", "در حال آماده‌سازی"],
  ["ready", "آماده"],
  ["dispatched", "ارسال شد"],
  ["delivered", "تحویل شد"],
  ["cancelled", "لغو شد"],
];

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
      <SmsGatewaySettingsPanel />

      <Card>
        <h3 className="mb-2 font-semibold">وضعیت‌های قابل استفاده سفارش</h3>
        <p className="mb-3 text-xs text-muted">فقط وضعیت‌های روشن در مدیریت سفارش‌ها به‌عنوان گزینه تغییر وضعیت نمایش داده می‌شوند. وضعیت خاموش در این فهرست محو نمایش داده می‌شود.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map(([key, label]) => {
            const enabled = settings.orderStatusEnabled?.[key] !== false;
            return <label key={key} className={"flex items-center justify-between gap-3 rounded-xl border border-line p-3 transition " + (enabled ? "" : "opacity-50 blur-[0.35px]")}>
              <span className="font-medium">{label}</span>
              <input type="checkbox" checked={enabled} onChange={(e) => {
                const next = { ...(settings.orderStatusEnabled ?? {}), [key]: e.target.checked };
                patchSettings({ orderStatusEnabled: next });
                const current = usePos.getState().settings;
                void saveRecord("settings", { id: "main", ...current, orderStatusEnabled: next, smsUser: "", smsKey: "", smsFrom: "" }, () => {});
              }} />
            </label>;
          })}
        </div>
      </Card>
      <Card className="grid gap-2 sm:grid-cols-2">
        <Field label="نام فروشگاه"><input className={inputCls} value={settings.shopName} onChange={(e) => patchSettings({ shopName: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="عنوان پیش‌فرض مشتری در صندوق"><input className={inputCls} value={settings.defaultCustomerLabel ?? "مشتری عزیز"} onChange={(e) => patchSettings({ defaultCustomerLabel: e.target.value })} onBlur={persistSettings} placeholder="مثلاً مشتری خالی" /><p className="text-xs text-muted">این عبارت به‌عنوان نام اولیه مشتری در صندوق نمایش داده می‌شود و هر زمان قابل تغییر است.</p></Field>
        <Field label="تلفن"><input className={inputCls} value={settings.phone} onChange={(e) => patchSettings({ phone: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="آدرس"><input className={inputCls} value={settings.address} onChange={(e) => patchSettings({ address: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="مالیات درصد"><input className={inputCls} type="number" min="0" max="100" step="0.01" value={settings.taxPercent} onChange={(e) => patchSettings({ taxPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} onBlur={persistSettings} /></Field>
        <Field label="آستانه هشدار تأخیر سفارش (دقیقه)">
          <input className={inputCls} type="number" min="1" max="240" value={settings.orderDelayMinutes ?? 20} onChange={(e) => patchSettings({ orderDelayMinutes: Math.min(240, Math.max(1, Number(e.target.value) || 1)) })} onBlur={persistSettings} />
        </Field>
        <div className="rounded-xl border border-line p-3 text-sm">
          <p className="font-semibold">فروش با هشدار کمبود موجودی</p>
          <p className="mt-1 text-muted">در صورت ناکافی‌بودن موجودی، هشدار نمایش داده می‌شود؛ ثبت سفارش متوقف نمی‌شود و کسری در موجودی انبار ثبت خواهد شد.</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.taxEnabled !== false} onChange={(e) => { const value = e.target.checked; patchSettings({ taxEnabled: value }); const current = usePos.getState().settings; void saveRecord("settings", { id: "main", ...current, taxEnabled: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />محاسبه مالیات فعال باشد</label>
        <Field label="هر چند تومان یک امتیاز"><input className={inputCls} type="number" min="1" step="1" value={settings.pointsPerToman} onChange={(e) => patchSettings({ pointsPerToman: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} onBlur={persistSettings} /></Field>
        <Field label="ارزش هر امتیاز"><input className={inputCls} type="number" min="1" step="1" value={settings.tomanPerPoint} onChange={(e) => patchSettings({ tomanPerPoint: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} onBlur={persistSettings} /></Field>
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


type SmsGatewayForm = {
  enabled: boolean;
  username: string;
  apiKey: string;
  sender: string;
  inboxLocation: string;
  inboxFrom: string;
};

function SmsGatewaySettingsPanel() {
  const [form,setForm]=useState<SmsGatewayForm>({enabled:false,username:"",apiKey:"",sender:"",inboxLocation:"",inboxFrom:""});
  const [hasApiKey,setHasApiKey]=useState(false);
  const [testPhone,setTestPhone]=useState("");
  const [testText,setTestText]=useState("پیام آزمایشی اتصال سامانه فروشگاهی 3Food");
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  const [connectionState,setConnectionState]=useState<"unknown"|"saved"|"connected"|"failed">("unknown");
  const [diagnosticsBusy,setDiagnosticsBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    void phpApi.getSmsGatewaySettings().then(result=>{
      if(!active)return;
      setForm(current=>({...current,enabled:result.enabled,username:result.username,sender:result.sender,inboxLocation:result.inboxLocation,inboxFrom:result.inboxFrom}));
      setHasApiKey(result.hasApiKey);
      setConnectionState(result.enabled ? "saved" : "unknown");
    }).catch(error=>{if(active)setNote(error instanceof Error?error.message:"بارگذاری تنظیمات پیامک انجام نشد.");});
    return()=>{active=false;};
  },[]);
  function patch(p:Partial<SmsGatewayForm>){setForm(current=>({...current,...p}));}
  async function save(){
    if(busy)return;
    setBusy(true);setNote("");
    try{
      const result=await phpApi.saveSmsGatewaySettings({
        enabled:form.enabled,username:form.username,apiKey:form.apiKey,
        sender:form.sender,
        inboxLocation:form.inboxLocation,inboxFrom:form.inboxFrom,
      });
      setHasApiKey(result.hasApiKey);setForm(current=>({...current,apiKey:""}));
      setConnectionState("saved");
      setNote("تنظیمات پیامک به‌صورت رمزگذاری‌شده ذخیره شد؛ اتصال هنوز تأیید نشده است. برای تأیید، پیام آزمایشی ارسال کنید.");
    }catch(error){setNote(error instanceof Error?error.message:"ذخیره تنظیمات پیامک انجام نشد.");}
    finally{setBusy(false);}
  }
  async function downloadDiagnostics(){
    if(diagnosticsBusy)return;
    setDiagnosticsBusy(true);setNote("");
    try{
      const report=await phpApi.getSmsDiagnostics();
      const lines=[
        "3Food POS - SMS diagnostic report",
        "Generated: "+report.generatedAt,
        "Provider: "+report.provider,
        "Storage source: "+report.storageSource,
        "Stored payload exists: "+report.storedPayloadExists,
        "Stored payload JSON valid: "+report.storedPayloadJsonValid,
        "Stored payload version supported: "+report.storedPayloadVersionSupported,
        "OpenSSL decrypt available: "+report.opensslDecryptAvailable,
        "Decryption succeeded: "+report.decryptionSucceeded,
        "Decrypt error: "+(report.decryptError??"none"),
        "Gateway enabled: "+report.enabled,
        "Username present: "+report.usernamePresent,
        "API key present: "+report.apiKeyPresent,
        "Sender present: "+report.senderPresent,
        "Diagnosis: "+report.reason,
        "",
        "No credentials, API keys, recipient numbers, or message contents are included."
      ];
      const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");link.href=url;link.download="3food-sms-diagnostics.txt";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
      setNote("گزارش عیب‌یابی آماده شد؛ فایل 3food-sms-diagnostics.txt دریافت شد.");
    }catch(error){setNote(error instanceof Error?error.message:"تهیه گزارش عیب‌یابی پیامک انجام نشد.");}
    finally{setDiagnosticsBusy(false);}
  }
  async function test(){
    if(busy)return;
    if(!/^09[0-9]{9}$/.test(testPhone.replace(/[^0-9]/g,""))){setNote("شماره مقصد باید یک موبایل معتبر ایران باشد.");return;}
    if(!testText.trim() || testText.trim().length>500){setNote("متن تست را وارد کنید (حداکثر ۵۰۰ نویسه).");return;}
    if(!form.username.trim() || !form.apiKey.trim() && !hasApiKey){setNote("برای تست ارسال، نام کاربری و API Key لازم است.");return;}
    if(!form.sender.trim()){setNote("سرشماره اختصاصی عادی مشتری را وارد کنید.");return;}
    setBusy(true);setNote("");
    try{
      const result=await phpApi.sendSms({to:testPhone.replace(/[^0-9]/g,""),text:testText.trim(),event:"manual",testMode:"standard"});
      setConnectionState(result.sent ? "connected" : "failed");
      setNote(result.sent?"اتصال و ارسال از خط اختصاصی عادی تأیید شد؛ تحویل نهایی به گوشی را از گزارش ارسال بررسی کنید.":`اتصال/ارسال تأیید نشد: ${result.detail}`);
    }catch(error){setNote(error instanceof Error?error.message:"ارسال پیامک آزمایشی انجام نشد.");}
    finally{setBusy(false);}
  }
  return <Card>
    <div className="mb-2">
      <h3 className="font-semibold">اتصال پیامک ملی‌پیامک</h3>
      <p className="mt-1 text-xs text-muted">فقط نام کاربری و API Key ملی‌پیامک لازم است. کلید فقط در سمت سرور و با رمزگذاری AES-256-GCM ذخیره می‌شود و پس از ذخیره دوباره نمایش داده نمی‌شود.</p>
      <p className="mt-2 text-sm" role="status">{connectionState==="connected"?"وضعیت اتصال: تأییدشده با پاسخ موفق سرویس":connectionState==="saved"?"وضعیت اتصال: تنظیمات ذخیره شده؛ هنوز اتصال تأیید نشده":connectionState==="failed"?"وضعیت اتصال: آخرین آزمایش ناموفق بود":"وضعیت اتصال: هنوز بررسی نشده"}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={e=>patch({enabled:e.target.checked})}/>ارسال پیامک فعال باشد</label>
      <Field label="نام کاربری ملی‌پیامک"><input className={inputCls} autoComplete="off" value={form.username} onChange={e=>patch({username:e.target.value})}/></Field>
      <Field label={hasApiKey?"API Key (برای تغییر وارد کنید)":"API Key"}>
        <input className={inputCls} type="password" autoComplete="new-password" placeholder={hasApiKey?"کلید ذخیره شده؛ خالی بگذارید تا حفظ شود":"API Key وب‌سرویس"} value={form.apiKey} onChange={e=>patch({apiKey:e.target.value})}/>
      </Field>
      <p className="text-xs text-muted sm:col-span-2">تمام درخواست‌های وب‌سرویس ملی‌پیامک، از جمله ارسال معمولی و الگوهای خدماتی، با API Key احراز هویت می‌شوند.</p>
      <Field label="سرشماره اصلی"><input className={inputCls} value={form.sender} onChange={e=>patch({sender:e.target.value})}/></Field>
      <Field label="شناسه صندوق ورودی (دریافت پاسخ تولد)"><input className={inputCls} inputMode="numeric" value={form.inboxLocation} onChange={e=>patch({inboxLocation:e.target.value})}/></Field>
      <Field label="سرشماره دریافت‌کننده پیامک ورودی"><input className={inputCls} value={form.inboxFrom} onChange={e=>patch({inboxFrom:e.target.value})}/></Field>
      <p className="text-xs text-amber-700 sm:col-span-2">ارسال آزمایشی یک پیامک واقعی است و ممکن است از اعتبار پنل هزینه کسر کند.</p>
      <Field label="شماره موبایل مقصد تست"><input className={inputCls} inputMode="tel" placeholder="09xxxxxxxxx" value={testPhone} onChange={e=>setTestPhone(e.target.value)}/></Field>
      <Field label="متن پیام آزمایشی با خط اختصاصی عادی"><input className={inputCls} value={testText} onChange={e=>setTestText(e.target.value)} maxLength={500}/></Field>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <Btn onClick={()=>void save()} disabled={busy}>{busy?"در حال ذخیره...":"ذخیره تنظیمات پیامک"}</Btn>
      <Btn tone="ghost" onClick={()=>void downloadDiagnostics()} disabled={busy||diagnosticsBusy}>{diagnosticsBusy?"در حال تهیه گزارش...":"دریافت گزارش عیب‌یابی"}</Btn>
      <Btn tone="ghost" onClick={()=>void test()} disabled={busy||!form.enabled}>{busy?"در حال انجام...":"تست ارسال از خط اختصاصی عادی"}</Btn>
    </div>
    {note?<p className="mt-2 text-sm" role="status">{note}</p>:null}
  </Card>;
}
