import { useEffect, useMemo, useState } from "react";
import { Btn, Card, Empty, Field, inputCls, PageHeading } from "./bits";
import { phpApi } from "@/lib/api/php-client";
import { tierOf, type SmsEvent } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";
import { normalizeIranPhone, tehranDate } from "@/lib/pos/formatters";

const INITIAL_RENDER_TIME = Date.now();
const EVENT_LABEL: Record<SmsEvent, string> = {
  order_created: "ثبت سفارش و ریز فاکتور", order_preparing: "شروع آماده‌سازی", order_ready: "آماده شدن", order_dispatched: "ارسال شد", order_delivered: "تحویل", order_cancelled: "لغو سفارش", order_invoice: "الگوی جایگزین ریز فاکتور",
  points_earned: "کسب امتیاز", discount_used: "استفاده از کد",
};

export function SmsScreen({ sendRaw, saveCentralRecord }: { sendRaw: (phone: string, text: string) => Promise<boolean>; saveCentralRecord: <T extends { id: string | number }>(resource: string, item: T, commit: () => void) => Promise<boolean> }) {
  const allTemplates = usePos((s) => s.templates);
  const templates = useMemo(() => {
    const events: SmsEvent[] = ["order_created", "order_preparing", "order_ready", "order_dispatched", "order_delivered", "order_cancelled", "order_invoice"];
    return events.map((event) => allTemplates.find((item) => item.event === event) ?? {
      id: event, event, enabled: false, body: "", bodyId: "", variables: [], managerEnabled: false,
    });
  }, [allTemplates]);
  const logs = usePos((s) => s.smsLogs);
  const saveTemplate = usePos((s) => s.saveTemplate);
  const customers = usePos((s) => s.customers);
  const orders = usePos((s) => s.orders);
  const settings = usePos((s) => s.settings);
  const patchSettings = usePos((s) => s.patchSettings);
  const [manual, setManual] = useState({ to: "", text: "" });
  // Keep the raw text while the user is typing. Parsing on every keystroke
  // removed empty segments and caused the cursor/input to jump after ";".
  const [variableDrafts, setVariableDrafts] = useState<Record<string, string>>({});
  function persistTemplateVariables(event: SmsEvent) {
    const current = usePos.getState().templates.find((x) => x.event === event);
    const raw = variableDrafts[event] ?? (current?.variables ?? []).join(";");
    const item = { ...(current ?? templates.find((x) => x.event === event)!), variables: raw.split(";").map((value) => value.trim()).filter(Boolean) };
    saveTemplate(item);
    void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item));
    setVariableDrafts((drafts) => { const next = { ...drafts }; delete next[event]; return next; });
  }
  const [birthdayPromptBusy, setBirthdayPromptBusy] = useState(false);
  const [birthdayPromptProgress, setBirthdayPromptProgress] = useState("");
  const products = usePos((s) => s.products);
  const [campaignLogic,setCampaignLogic]=useState<"all"|"any">("all");
  const [campaignFilters,setCampaignFilters]=useState({tier:"",birthday:"",inactiveDays:"",minOrders:"",minSpent:"",productId:""});
  const [campaignText,setCampaignText]=useState("");
  const [campaignBusy,setCampaignBusy]=useState(false);
  const [campaignProgress,setCampaignProgress]=useState("");
  const [campaignClock,setCampaignClock]=useState(INITIAL_RENDER_TIME);
  useEffect(() => { const timer=window.setInterval(()=>setCampaignClock(Date.now()),60000); return ()=>window.clearInterval(timer); }, []);
  const activeCampaignFilters = Object.entries(campaignFilters).filter(([,value])=>value!=="");
  const campaignRecipients=customers.filter(customer=>{
    if(customer.smsConsent!==true||!normalizeIranPhone(customer.phone))return false;
    const customerOrders=orders.filter(order=>order.status!=="cancelled"&&(order.customerId===customer.id||normalizeIranPhone(order.customerPhone)===normalizeIranPhone(customer.phone)));
    const latest=customerOrders.reduce((max,order)=>Math.max(max,new Date(order.createdAt).getTime()),0);
    const conditions:boolean[]=[];
    if(campaignFilters.tier)conditions.push(tierOf(customer.points,settings)===campaignFilters.tier);
    if(campaignFilters.birthday==="month")conditions.push(!!customer.birthday&&customer.birthday.slice(5,7)===tehranDate().slice(5,7));
    if(campaignFilters.birthday==="known")conditions.push(!!customer.birthday);
    if(campaignFilters.inactiveDays){const days=Number(campaignFilters.inactiveDays);const baseline=latest||new Date(customer.createdAt||0).getTime();conditions.push(days>0&&(!baseline||campaignClock-baseline>=days*86400000));}
    if(campaignFilters.minOrders)conditions.push(customerOrders.length>=Number(campaignFilters.minOrders));
    if(campaignFilters.minSpent)conditions.push(customer.totalSpent>=Number(campaignFilters.minSpent));
    if(campaignFilters.productId)conditions.push(customerOrders.some(order=>order.lines.some(line=>line.productId===campaignFilters.productId)));
    return conditions.length===0|| (campaignLogic==="all"?conditions.every(Boolean):conditions.some(Boolean));
  });
  async function runCampaign(){
    if(campaignBusy||!campaignText.trim()||!campaignRecipients.length)return;
    if(campaignText.length>950){window.alert("متن پیامک باید حداکثر ۹۵۰ نویسه باشد.");return;}
    if(!window.confirm(`پیامک برای ${campaignRecipients.length.toLocaleString("fa-IR")} مشتری ارسال شود؟`))return;
    setCampaignBusy(true);let sent=0,failed=0;
    for(const customer of campaignRecipients){const ok=await sendRaw(customer.phone,campaignText);if(ok)sent++;else failed++;setCampaignProgress(`${(sent+failed).toLocaleString("fa-IR")} از ${campaignRecipients.length.toLocaleString("fa-IR")} · موفق ${sent.toLocaleString("fa-IR")} · ناموفق ${failed.toLocaleString("fa-IR")}`);}
    setCampaignBusy(false);setCampaignProgress(`پایان کمپین — موفق ${sent.toLocaleString("fa-IR")}، ناموفق ${failed.toLocaleString("fa-IR")}`);
  }
  return (
    <div className="space-y-4">
      <PageHeading title="الگوهای پیامک وضعیت سفارش" description="ارسال اعلان هر وضعیت به مشتری و مدیر به‌صورت مستقل قابل تنظیم است؛ همه اعلان‌ها از الگوی خدماتی تأییدشده ارسال می‌شوند." />
      <Card>
        <p className="mt-2 text-xs text-muted">اتصال و کلید API از بخش تنظیمات فروشگاه ثبت می‌شود و فقط به‌صورت رمزگذاری‌شده در سرور نگهداری خواهد شد. برای الگوی خدماتی، شناسه واقعی الگوی تأییدشده و ترتیب متغیرها را وارد کنید.</p>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">شماره مدیر برای دریافت اعلان‌ها</h3>
        <p className="mb-2 text-xs text-muted">شماره مدیر مستقل از شماره مشتری است. برای هر وضعیت می‌توانید ارسال به مشتری و مدیر را جداگانه روشن یا خاموش کنید.</p>
        <Field label="شماره موبایل مدیر"><input className={inputCls} dir="ltr" inputMode="tel" placeholder="09xxxxxxxxx" value={settings.smsManagerPhone ?? ""} onChange={(e) => patchSettings({ smsManagerPhone: e.target.value })} onBlur={() => { const current = usePos.getState().settings; void saveCentralRecord("settings", { id: "main", ...current, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} /></Field>
      </Card>
      {templates.map((t) => (
        <Card key={t.event}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong>{EVENT_LABEL[t.event]}</strong>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted">مشتری:</span>
                <button type="button" aria-pressed={t.enabled} onClick={() => {
                  const item = { ...t, enabled: !t.enabled };
                  void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item));
                }} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${t.enabled ? "border-leaf/40 bg-leaf/10 text-leaf" : "border-line bg-muted/10 text-muted"}`}>
                  {t.enabled ? "فعال" : "غیرفعال"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted">مدیر:</span>
                <button type="button" aria-pressed={t.managerEnabled === true} onClick={() => {
                  const item = { ...t, managerEnabled: t.managerEnabled !== true };
                  void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item));
                }} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${t.managerEnabled === true ? "border-leaf/40 bg-leaf/10 text-leaf" : "border-line bg-muted/10 text-muted"}`}>
                  {t.managerEnabled === true ? "فعال" : "غیرفعال"}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">برای این وضعیت هیچ متن آزاد یا روش ارسال جایگزینی استفاده نمی‌شود.</p>
          {t.event === "order_created" ? <p className="mt-1 text-xs font-medium text-leaf">متغیر «order» در این رویداد به‌صورت ریز فاکتور متنی ارسال می‌شود؛ کد سفارش به‌تنهایی ارسال نخواهد شد.</p> : null}
          {t.event === "order_invoice" ? <p className="mt-1 text-xs text-muted">فقط وقتی استفاده می‌شود که الگوی «ثبت سفارش و ریز فاکتور» فعال و تنظیم نشده باشد.</p> : null}
          <Field label="شناسه الگوی خدماتی تأییدشده"><input className={inputCls} value={t.bodyId} onChange={(e) => saveTemplate({ ...t, bodyId: e.target.value })} onBlur={() => { const item = usePos.getState().templates.find((x) => x.event === t.event); if (item) void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item)); }} /></Field>
          <Field label="ترتیب متغیرهای الگوی خدماتی">
            <input className={inputCls} placeholder="name;order;total;shop" value={variableDrafts[t.event] ?? (t.variables ?? []).join(";")} onChange={(e) => setVariableDrafts((drafts) => ({ ...drafts, [t.event]: e.target.value }))} onBlur={() => persistTemplateVariables(t.event)} />
          </Field>
          <div className="mt-2"><Btn onClick={() => { const item = usePos.getState().templates.find((x) => x.event === t.event); if (item) void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item)); }}>ذخیره الگو</Btn></div>
          <p className="text-xs text-muted">کلیدهای قابل استفاده: name، order، total، points، code، balance، shop. در رویداد ثبت سفارش، مقدار order شامل ریز اقلام فاکتور است. برای جدا کردن متغیرها حتماً از علامت ; استفاده کنید (مثال: name;order;total;shop). ترتیب را دقیقاً مطابق الگوی تأییدشده پنل ملی‌پیامک وارد کنید؛ فقط مقادیر متغیرها ارسال می‌شوند.</p>
        </Card>
      ))}
      <Card>
        <h3 className="mb-2 font-semibold">دریافت تاریخ تولد از پیامک</h3>
        <p className="mb-2 text-xs text-muted">پس از تنظیم صندوق ورودی در تنظیمات فروشگاه، پاسخ‌های «تولد ۱۳۷۰/۰۵/۱۲» را دریافت و فقط برای شماره مشتری یکتای منطبق ثبت می‌کند. تاریخ تولد موجود بازنویسی نمی‌شود.</p>
        <Btn onClick={async () => {
          try {
            const result = await phpApi.syncBirthdaySmsInbox();
            window.alert(`بررسی صندوق انجام شد. دریافت: ${result.received}، تاریخ تولد ثبت‌شده: ${result.birthdays_saved}، تکراری: ${result.duplicates}، نامنطبق: ${result.unmatched}، نادیده‌گرفته‌شده: ${result.ignored}`);
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "دریافت پیامک انجام نشد.");
          }
        }}>دریافت و ثبت پاسخ‌های تولد</Btn>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">ارسال درخواست تاریخ تولد</h3>
        <p className="mb-2 text-xs text-muted">فقط به مشتریانی پیامک می‌فرستد که رضایت پیامکی دارند و تاریخ تولدشان ثبت نشده است. مشتری باید تاریخ را با قالب نمونه پاسخ دهد.</p>
        <textarea className={inputCls} rows={2} maxLength={950} value={settings.birthdaySmsPrompt ?? "برای ثبت تاریخ تولد در باشگاه مشتریان، لطفاً پاسخ دهید: تولد ۱۳۷۰/۰۵/۱۲"} onChange={e=>patchSettings({birthdaySmsPrompt:e.target.value})} onBlur={()=>{const current=usePos.getState().settings;void saveCentralRecord("settings",{id:"main",...current,smsUser:"",smsKey:"",smsFrom:""},()=>{});}} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Btn disabled={birthdayPromptBusy || !(settings.birthdaySmsPrompt ?? "برای ثبت تاریخ تولد در باشگاه مشتریان، لطفاً پاسخ دهید: تولد ۱۳۷۰/۰۵/۱۲").trim()} onClick={async () => {
            const targets = customers.filter(customer => customer.smsConsent === true && !customer.birthday && /^09[0-9]{9}$/.test(normalizeIranPhone(customer.phone)));
            if (!targets.length) { window.alert("مشتری واجد شرایطی برای دریافت درخواست وجود ندارد."); return; }
            if (!window.confirm(`درخواست ثبت تاریخ تولد برای ${targets.length.toLocaleString("fa-IR")} مشتری ارسال شود؟`)) return;
            setBirthdayPromptBusy(true);
            let sent = 0, failed = 0;
            for (const customer of targets) {
              if (await sendRaw(customer.phone, settings.birthdaySmsPrompt ?? "")) sent++; else failed++;
              setBirthdayPromptProgress(`موفق ${sent.toLocaleString("fa-IR")} · ناموفق ${failed.toLocaleString("fa-IR")} از ${targets.length.toLocaleString("fa-IR")}`);
            }
            setBirthdayPromptBusy(false);
            setBirthdayPromptProgress(`پایان ارسال — موفق ${sent.toLocaleString("fa-IR")}، ناموفق ${failed.toLocaleString("fa-IR")}`);
          }}>{birthdayPromptBusy ? "در حال ارسال..." : "ارسال درخواست به مشتریان واجد شرایط"}</Btn>
          <span className="text-xs text-muted">{birthdayPromptProgress}</span>
        </div>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">ارسال دستی</h3>
        <div className="grid gap-2">
          <input className={inputCls} placeholder="شماره" value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} />
          <textarea className={inputCls} rows={2} value={manual.text} onChange={(e) => setManual({ ...manual, text: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => void sendRaw(manual.to, manual.text)}>ارسال به یک شماره</Btn>
            
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">کمپین باشگاه مشتریان</h3>
        <p className="mb-2 text-xs text-muted">فقط اعضایی انتخاب می‌شوند که رضایت دریافت پیامک تبلیغاتی را ثبت کرده باشند. می‌توانید چند شرط را ترکیب کنید. کمپین‌ها همیشه از خط اختصاصی عادی فروشگاه ارسال می‌شوند.</p>
        <Field label="نحوه ترکیب شروط"><select className={inputCls} value={campaignLogic} onChange={e=>setCampaignLogic(e.target.value as "all"|"any")}><option value="all">همه شروط برقرار باشند (AND)</option><option value="any">حداقل یکی از شروط برقرار باشد (OR)</option></select></Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="سطح عضویت"><select className={inputCls} value={campaignFilters.tier} onChange={e=>setCampaignFilters({...campaignFilters,tier:e.target.value})}><option value="">همه سطوح</option><option value="bronze">برنز</option><option value="silver">نقره</option><option value="gold">طلا</option><option value="platinum">پلاتین</option></select></Field>
          <Field label="تاریخ تولد"><select className={inputCls} value={campaignFilters.birthday} onChange={e=>setCampaignFilters({...campaignFilters,birthday:e.target.value})}><option value="">بدون شرط</option><option value="month">متولدین ماه جاری</option><option value="known">دارای تاریخ تولد ثبت‌شده</option></select></Field>
          <Field label="عدم خرید در چند روز اخیر"><input className={inputCls} type="number" min="1" max="3650" value={campaignFilters.inactiveDays} onChange={e=>setCampaignFilters({...campaignFilters,inactiveDays:e.target.value})} placeholder="مثلاً ۴۵ روز"/></Field>
          <Field label="حداقل تعداد سفارش"><input className={inputCls} type="number" min="1" value={campaignFilters.minOrders} onChange={e=>setCampaignFilters({...campaignFilters,minOrders:e.target.value})} placeholder="مثلاً ۳"/></Field>
          <Field label="حداقل مجموع خرید (تومان)"><input className={inputCls} type="number" min="1" value={campaignFilters.minSpent} onChange={e=>setCampaignFilters({...campaignFilters,minSpent:e.target.value})} placeholder="مثلاً ۱۰۰۰۰۰۰"/></Field>
          <Field label="خرید محصول مشخص"><select className={inputCls} value={campaignFilters.productId} onChange={e=>setCampaignFilters({...campaignFilters,productId:e.target.value})}><option value="">همه محصولات</option>{products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>
        </div>
        <div className="flex justify-end"><Btn tone="ghost" onClick={()=>setCampaignFilters({tier:"",birthday:"",inactiveDays:"",minOrders:"",minSpent:"",productId:""})}>پاک کردن شروط</Btn></div>
        <p className="my-2 text-sm">تعداد شروط فعال: <b>{activeCampaignFilters.length.toLocaleString("fa-IR")}</b> · تعداد گیرندگان واجد شرایط و دارای رضایت: <b>{campaignRecipients.length.toLocaleString("fa-IR")}</b></p>
        <textarea className={inputCls} rows={3} maxLength={950} value={campaignText} onChange={e=>setCampaignText(e.target.value)} placeholder="متن پیامک کمپین..."/>
        <div className="mt-2 flex flex-wrap items-center gap-2"><Btn onClick={()=>void runCampaign()} disabled={campaignBusy||!campaignText.trim()||campaignRecipients.length===0}>{campaignBusy?"در حال ارسال...":"ارسال کمپین"}</Btn><span className="text-xs text-muted">{campaignProgress}</span></div>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">لاگ ارسال</h3>
        {logs.length === 0 ? <Empty text="ارسالی ثبت نشده" /> : logs.slice(0, 50).map((l) => (
          <details key={l.id} className="border-b border-line py-2 text-sm">
            <summary className="cursor-pointer"><span className={l.ok ? "text-leaf" : "text-warn"}>{l.ok ? "پذیرفته‌شده" : "ناموفق/نامشخص"}</span> — {l.to} — {new Date(l.at).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"})} — {l.detail}</summary>
            <div className="mt-2 space-y-1 rounded-lg bg-muted/20 p-2 text-xs">
              <p>رویداد: {EVENT_LABEL[l.event as SmsEvent] ?? l.event} · روش: {l.mode ?? "نامشخص"} · HTTP: {l.httpStatus ?? "نامشخص"}</p>
              {l.bodyId ? <p>شناسه الگو: {l.bodyId}</p> : null}
              {l.variables?.length ? <p>متغیرها: {l.variables.join(";")}</p> : null}
              {l.text ? <p className="break-words">متن: {l.text}</p> : null}
              {l.providerEndpoint ? <p>مسیر سرویس: {l.providerEndpoint}</p> : null}
              {l.providerResponse ? <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-surface p-2" dir="ltr">{l.providerResponse}</pre> : <p>پاسخ خام سرویس در دسترس نیست؛ {l.detail}</p>}
              <p className="text-muted">پذیرش درخواست به معنی تحویل قطعی به گوشی نیست.</p>
            </div>
          </details>
        ))}
      </Card>
    </div>
  );
}
