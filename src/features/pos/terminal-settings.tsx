import { useEffect, useState } from "react";
import { Btn, Card, Field, inputCls } from "./bits";
import { phpApi, type PaymentTerminal, type TerminalAgent } from "@/lib/api/php-client";
import { uid } from "@/lib/pos/model";

function TerminalSettingsPanel() {
  const [agents,setAgents]=useState<TerminalAgent[]>([]);
  const [terminals,setTerminals]=useState<PaymentTerminal[]>([]);
  const [agentName,setAgentName]=useState("صندوق اصلی");
  const [newToken,setNewToken]=useState("");
  const [agentId,setAgentId]=useState("");
  const [localKey,setLocalKey]=useState("terminal-1");
  const [terminalName,setTerminalName]=useState("کارتخوان اصلی");
  const [provider,setProvider]=useState("unknown");
  const [model,setModel]=useState("");
  const [driverCode,setDriverCode]=useState("unconfigured");
  const [host,setHost]=useState("192.168.1.100");
  const [port,setPort]=useState("5000");
  const [connection,setConnection]=useState<"lan"|"wifi">("lan");
  const [isDefault,setIsDefault]=useState(false);
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  async function refresh(){
    const [a,t]=await Promise.all([phpApi.listTerminalAgents(),phpApi.listTerminals()]);
    setAgents(a.items);setTerminals(t.items);
    if(!agentId&&a.items[0])setAgentId(a.items[0].id);
  }
  useEffect(()=>{let active=true;void Promise.all([phpApi.listTerminalAgents(),phpApi.listTerminals()]).then(([a,t])=>{if(!active)return;setAgents(a.items);setTerminals(t.items);if(a.items[0])setAgentId(a.items[0].id);}).catch(e=>{if(active)setNote(e instanceof Error?e.message:"دریافت تنظیمات کارتخوان انجام نشد");});return()=>{active=false;};},[]);
  async function createAgent(){
    setBusy(true);setNote("");setNewToken("");
    try{const result=await phpApi.createTerminalAgent(agentName.trim());setNewToken(result.token);await refresh();setAgentId(result.agent.id);setNote("عامل محلی ساخته شد. توکن فقط همین یک‌بار نمایش داده می‌شود.");}
    catch(e){setNote(e instanceof Error?e.message:"ساخت عامل محلی انجام نشد");}finally{setBusy(false);}
  }
  async function saveTerminal(){
    setBusy(true);setNote("");
    try{
      if(!agentId)throw new Error("ابتدا یک کامپیوتر صندوق تعریف کنید.");
      await phpApi.saveTerminal({id:uid("pt"),agentId,localTerminalKey:localKey.trim(),name:terminalName.trim(),providerCode:provider,modelName:model.trim(),driverCode:driverCode.trim()||"unconfigured",connectionType:connection,host:host.trim(),port:Number(port),enabled:true,isDefault:isDefault||terminals.length===0});
      await refresh();setNote("مشخصات کارتخوان ذخیره شد. تا نصب درایور تأییدشده، پرداخت واقعی غیرفعال می‌ماند.");
    }catch(e){setNote(e instanceof Error?e.message:"ذخیره کارتخوان انجام نشد");}finally{setBusy(false);}
  }
  async function disableAgent(id:string){if(!window.confirm("عامل محلی غیرفعال شود؟ دستگاه‌های متصل به آن دیگر پرداخت نمی‌پذیرند."))return;setBusy(true);try{await phpApi.disableTerminalAgent(id);await refresh();}catch(e){setNote(e instanceof Error?e.message:"غیرفعال‌سازی انجام نشد");}finally{setBusy(false);}}
  async function disableTerminal(id:string){if(!window.confirm("این کارتخوان غیرفعال شود؟"))return;setBusy(true);try{await phpApi.disableTerminal(id);await refresh();}catch(e){setNote(e instanceof Error?e.message:"غیرفعال‌سازی انجام نشد");}finally{setBusy(false);}}
  return <Card className="space-y-4">
    <div><h3 className="font-semibold">مدیریت کارتخوان‌های بانکی</h3><p className="mt-1 text-xs leading-6 text-muted">اتصال شبکه‌ای چندکارتخوان از طریق عامل محلی صندوق طراحی شده است. ابتدا کامپیوتری که به شبکه کارتخوان دسترسی دارد ثبت می‌شود.</p></div>
    <div className="rounded-xl border border-line bg-bg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">۱. ثبت کامپیوتر صندوق</p><Btn tone="ghost" onClick={()=>void refresh()} disabled={busy}>به‌روزرسانی وضعیت</Btn></div>
      <div className="flex flex-col gap-2 sm:flex-row"><input className={inputCls+" flex-1"} aria-label="نام کامپیوتر صندوق" value={agentName} onChange={e=>setAgentName(e.target.value)} placeholder="نام کامپیوتر صندوق"/><Btn onClick={()=>void createAgent()} disabled={busy||!agentName.trim()}>ساخت عامل محلی</Btn></div>
      {newToken?<div className="space-y-2 rounded-lg border border-warn bg-warn-bg p-3"><p className="text-xs text-warn">توکن اتصال را در محل امن نگه دارید؛ پس از بستن صفحه دیگر نمایش داده نمی‌شود.</p><code className="block break-all text-xs">{newToken}</code><Btn tone="ghost" onClick={()=>void navigator.clipboard.writeText(newToken)}>کپی توکن</Btn></div>:null}
      {agents.length?<div className="space-y-2">{agents.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3"><div><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-muted">{a.enabled?"فعال":"غیرفعال"} · آخرین ارتباط: {a.last_seen_at??"هنوز متصل نشده"}</p></div>{a.enabled?<Btn tone="ghost" onClick={()=>void disableAgent(a.id)} disabled={busy}>غیرفعال‌سازی</Btn>:null}</div>)}</div>:<p className="text-xs text-muted">هنوز کامپیوتر صندوقی ثبت نشده است.</p>}
    </div>
    <div className="space-y-3">
      <p className="text-sm font-semibold">۲. افزودن کارتخوان شبکه‌ای</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="کامپیوتر صندوق"><select className={inputCls} value={agentId} onChange={e=>setAgentId(e.target.value)}><option value="">انتخاب کنید</option>{agents.filter(a=>Boolean(a.enabled)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="نام کارتخوان"><input className={inputCls} value={terminalName} onChange={e=>setTerminalName(e.target.value)}/></Field>
        <Field label="شرکت پرداخت"><select className={inputCls} value={provider} onChange={e=>setProvider(e.target.value)}><option value="unknown">نامشخص</option><option value="behpardakht">به‌پرداخت ملت</option><option value="sep">پرداخت الکترونیک سامان‌کیش (سپ)</option><option value="iran_kish">ایران‌کیش</option><option value="asan_pardakht">آسان پرداخت</option><option value="pasargad">پاسارگاد</option><option value="parsian">پارسیان</option><option value="other">سایر</option></select></Field>
        <Field label="مدل دستگاه"><input className={inputCls} value={model} onChange={e=>setModel(e.target.value)} placeholder="مدل کارتخوان"/></Field>
        <Field label="کد درایور"><input className={inputCls} value={driverCode} onChange={e=>setDriverCode(e.target.value)} placeholder="unconfigured"/></Field>
        {provider==="sep"&&<p className="sm:col-span-2 rounded-lg border border-line bg-bg p-3 text-xs leading-6 text-muted">سامان‌کیش (سپ): مسیر اتصال Central PC-POS باید با مشخصات پذیرنده و مستندات رسمی سپ فعال شود. تا نصب درایور تأییدشده، پرداخت واقعی ارسال نمی‌شود. IP یا پورت را حدس نزنید.</p>}
        <Field label="نوع اتصال"><select className={inputCls} value={connection} onChange={e=>setConnection(e.target.value as "lan"|"wifi")}><option value="lan">کابل شبکه (LAN)</option><option value="wifi">Wi-Fi</option></select></Field>
        <Field label="IP کارتخوان"><input className={inputCls} value={host} onChange={e=>setHost(e.target.value)} placeholder="192.168.1.100"/></Field>
        <Field label="پورت"><input className={inputCls} type="number" min="1" max="65535" value={port} onChange={e=>setPort(e.target.value)}/></Field>
        <Field label="کلید محلی دستگاه"><input className={inputCls} value={localKey} onChange={e=>setLocalKey(e.target.value)} placeholder="terminal-1"/></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isDefault} onChange={e=>setIsDefault(e.target.checked)}/> انتخاب به‌عنوان کارتخوان پیش‌فرض</label>
      <div className="rounded-lg bg-bg p-3 text-xs leading-6 text-muted">کد درایور باید دقیقاً با افزونه معتبر نصب‌شده روی عامل محلی مطابقت داشته باشد. تا زمانی که درایور رسمی و تأییدشده نصب نشده، مقدار را «unconfigured» نگه دارید؛ واردکردن IP یا کد دلخواه به‌تنهایی اتصال بانکی ایجاد نمی‌کند.</div>
      <Btn onClick={()=>void saveTerminal()} disabled={busy||!agentId||!terminalName.trim()||!localKey.trim()||!host.trim()||!Number.isInteger(Number(port))||Number(port)<1||Number(port)>65535}>ذخیره کارتخوان</Btn>
      {terminals.length?<div className="space-y-2">{terminals.map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3"><div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-muted" dir="ltr">{t.host}:{t.port} · {t.provider_code??"unknown"} · {t.driver_code??"unconfigured"}</p><p className="text-xs text-muted">{t.enabled?"فعال":"غیرفعال"}{t.is_default?" · پیش‌فرض":""} · {t.agent_name??""}</p></div>{t.enabled?<Btn tone="ghost" onClick={()=>void disableTerminal(t.id)} disabled={busy}>غیرفعال‌سازی</Btn>:null}</div>)}</div>:null}
    </div>
    {note?<p className="text-sm text-muted" role="status">{note}</p>:null}
  </Card>;
}
