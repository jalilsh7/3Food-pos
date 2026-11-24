import { useEffect, useRef, useState } from "react";
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
      <SmsGatewaySettingsPanel />
      <Card className="grid gap-2 sm:grid-cols-2">
        <Field label="نام فروشگاه"><input className={inputCls} value={settings.shopName} onChange={(e) => patchSettings({ shopName: e.target.value })} onBlur={persistSettings} /></Field>
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


type SmsGatewayForm = {
  enabled: boolean;
  mode: "standard" | "smart_sms";
  username: string;
  apiKey: string;
  password: string;
  sender: string;
  senderSupportOne: string;
  senderSupportTwo: string;
  inboxLocation: string;
  inboxFrom: string;
};

function SmsGatewaySettingsPanel() {
  const [form,setForm]=useState<SmsGatewayForm>({enabled:false,mode:"standard",username:"",apiKey:"",password:"",sender:"",senderSupportOne:"",senderSupportTwo:"",inboxLocation:"",inboxFrom:""});
  const [hasApiKey,setHasApiKey]=useState(false);
  const [hasPassword,setHasPassword]=useState(false);
  const [testPhone,setTestPhone]=useState("");
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  useEffect(()=>{
    let active=true;
    void phpApi.getSmsGatewaySettings().then(result=>{
      if(!active)return;
      setForm(current=>({...current,enabled:result.enabled,mode:result.mode,username:result.username,sender:result.sender,senderSupportOne:result.senderSupportOne,senderSupportTwo:result.senderSupportTwo,inboxLocation:result.inboxLocation,inboxFrom:result.inboxFrom}));
      setHasApiKey(result.hasApiKey);
      setHasPassword(result.hasPassword);
    }).catch(error=>{if(active)setNote(error instanceof Error?error.message:"بارگذاری تنظیمات پیامک انجام نشد.");});
    return()=>{active=false;};
  },[]);
  function patch(p:Partial<SmsGatewayForm>){setForm(current=>({...current,...p}));}
  async function save(){
    if(busy)return;
    setBusy(true);setNote("");
    try{
      const result=await phpApi.saveSmsGatewaySettings({
        enabled:form.enabled,mode:form.mode,username:form.username,apiKey:form.apiKey,password:form.password,
        sender:form.sender,senderSupportOne:form.senderSupportOne,senderSupportTwo:form.senderSupportTwo,
        inboxLocation:form.inboxLocation,inboxFrom:form.inboxFrom,
      });
      setHasApiKey(result.hasApiKey);setHasPassword(result.hasPassword);setForm(current=>({...current,apiKey:"",password:""}));
      setNote("تنظیمات پیامک به‌صورت رمزگذاری‌شده در سرور ذخیره شد.");
    }catch(error){setNote(error instanceof Error?error.message:"ذخیره تنظیمات پیامک انجام نشد.");}
    finally{setBusy(false);}
  }
  async function test(){
    if(busy)return;
    if(!/^09[0-9]{9}$/.test(testPhone.replace(/[^0-9]/g,""))){setNote("شماره آزمایش باید یک موبایل معتبر ایران باشد.");return;}
    setBusy(true);setNote("");
    try{
      const text=form.mode==="smart_sms"?"آزمایش اتصال پیامک 3Food لغو11":"آزمایش اتصال پیامک 3Food";
      const result=await phpApi.sendSms({to:testPhone.replace(/[^0-9]/g,""),text});
      setNote(result.sent?"پاسخ سرویس، پذیرش ارسال را تأیید کرد. هزینه پیامک ممکن است محاسبه شود.":`ارسال تأیید نشد: ${result.detail}`);
    }catch(error){setNote(error instanceof Error?error.message:"آزمایش اتصال انجام نشد.");}
    finally{setBusy(false);}
  }
  return <Card>
    <div className="mb-2">
      <h3 className="font-semibold">اتصال پیامک ملی‌پیامک</h3>
      <p className="mt-1 text-xs text-muted">نام کاربری، رمز عبور و API Key فقط در سمت سرور و با رمزگذاری AES-256-GCM ذخیره می‌شوند؛ مقادیر محرمانه پس از ذخیره دوباره نمایش داده نمی‌شوند.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={e=>patch({enabled:e.target.checked})}/>ارسال پیامک فعال باشد</label>
      <Field label="روش ارسال">
        <select className={inputCls} value={form.mode} onChange={e=>patch({mode:e.target.value as SmsGatewayForm["mode"]})}>
          <option value="standard">ارسال معمولی با سرشماره اختصاصی</option>
          <option value="smart_sms">SmartSMS با API Key و خطوط پشتیبان</option>
        </select>
      </Field>
      <Field label="نام کاربری ملی‌پیامک"><input className={inputCls} autoComplete="off" value={form.username} onChange={e=>patch({username:e.target.value})}/></Field>
      <Field label={hasPassword?"رمز عبور حساب (برای تغییر وارد کنید)":"رمز عبور حساب"}><input className={inputCls} type="password" autoComplete="new-password" placeholder={hasPassword?"ذخیره شده؛ خالی بگذارید تا حفظ شود":"رمز عبور وب‌سرویس ارسال معمولی"} value={form.password} onChange={e=>patch({password:e.target.value})}/></Field>
      <Field label={hasApiKey?"API Key (برای تغییر وارد کنید)":"API Key"}>
        <input className={inputCls} type="password" autoComplete="new-password" placeholder={hasApiKey?"کلید ذخیره شده؛ خالی بگذارید تا حفظ شود":"API Key وب‌سرویس"} value={form.apiKey} onChange={e=>patch({apiKey:e.target.value})}/>
      </Field>
      <p className="text-xs text-muted sm:col-span-2">ارسال معمولی از رمز عبور حساب استفاده می‌کند؛ SmartSMS و الگوهای خدماتی از API Key استفاده می‌کنند. هر دو مقدار رمزگذاری‌شده و فقط در سرور ذخیره می‌شوند.</p>
      <Field label="سرشماره اصلی"><input className={inputCls} value={form.sender} onChange={e=>patch({sender:e.target.value})}/></Field>
      {form.mode==="smart_sms"?<>
        <Field label="سرشماره پشتیبان ۱"><input className={inputCls} value={form.senderSupportOne} onChange={e=>patch({senderSupportOne:e.target.value})}/></Field>
        <Field label="سرشماره پشتیبان ۲"><input className={inputCls} value={form.senderSupportTwo} onChange={e=>patch({senderSupportTwo:e.target.value})}/></Field>
      </>:null}
      <Field label="شناسه صندوق ورودی (دریافت پاسخ تولد)"><input className={inputCls} inputMode="numeric" value={form.inboxLocation} onChange={e=>patch({inboxLocation:e.target.value})}/></Field>
      <Field label="سرشماره دریافت‌کننده پیامک ورودی"><input className={inputCls} value={form.inboxFrom} onChange={e=>patch({inboxFrom:e.target.value})}/></Field>
      <Field label="شماره موبایل برای آزمایش اتصال"><input className={inputCls} inputMode="tel" placeholder="09xxxxxxxxx" value={testPhone} onChange={e=>setTestPhone(e.target.value)}/></Field>
    </div>
    {form.mode==="smart_sms"?<p className="mt-2 text-xs text-muted">طبق مستند SmartSMS، پیام‌های این مسیر باید با «لغو11» تمام شوند. برنامه متن پیام را خودکار تغییر نمی‌دهد؛ این قاعده در زمان ارسال کنترل می‌شود.</p>:null}
    <div className="mt-3 flex flex-wrap gap-2">
      <Btn onClick={()=>void save()} disabled={busy}>{busy?"در حال ذخیره...":"ذخیره تنظیمات پیامک"}</Btn>
      <Btn tone="ghost" onClick={()=>void test()} disabled={busy||!form.enabled}>{busy?"در حال انجام...":"آزمایش ارسال پیامک"}</Btn>
    </div>
    {note?<p className="mt-2 text-sm" role="status">{note}</p>:null}
  </Card>;
}
