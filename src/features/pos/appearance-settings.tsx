import { useState } from "react";
import { Btn, Card, Field, inputCls } from "./bits";
import type { AppearanceSettings } from "@/lib/api/php-client";
import { APPEARANCE_PRESETS, useAppearance } from "@/lib/appearance";

function AppearanceSettingsPanel(){
 const {settings,update,save,reset,uploadLogo}=useAppearance();
 const [busy,setBusy]=useState(false),[logoBusy,setLogoBusy]=useState(false),[note,setNote]=useState("");
 async function persist(){setBusy(true);setNote("");try{await save();setNote("ظاهر جدید برای همه کاربران ذخیره شد.");}catch(e){setNote(e instanceof Error?e.message:"ذخیره ظاهر انجام نشد.");}finally{setBusy(false);}}
 async function restore(){if(!window.confirm("همه تنظیمات ظاهری به حالت پیش‌فرض برگردد؟"))return;setBusy(true);setNote("");try{await reset();setNote("ظاهر پیش‌فرض برای همه کاربران فعال شد.");}catch(e){setNote(e instanceof Error?e.message:"بازنشانی انجام نشد.");}finally{setBusy(false);}}
 async function logo(file?:File){if(!file)return;setLogoBusy(true);setNote("");try{await uploadLogo(file);setNote("لوگو بارگذاری شد؛ برای انتشار آن روی همه دستگاه‌ها «ذخیره ظاهر» را بزنید.");}catch(e){setNote(e instanceof Error?e.message:"بارگذاری لوگو انجام نشد.");}finally{setLogoBusy(false);}}
 return <Card className="space-y-4">
 <div><h3 className="font-semibold">طراحی ظاهری سراسری</h3><p className="mt-1 text-xs text-muted">تغییرات زنده پیش‌نمایش می‌شوند؛ پس از ذخیره برای همه کاربران و دستگاه‌ها اعمال خواهند شد.</p></div>
 <div>
  <p className="mb-2 text-sm font-semibold">ترکیب‌رنگ‌های آماده</p>
  <p className="mb-3 text-xs text-muted">پالت‌های کلاسیک و مدرن آماده؛ سه ترکیب مدرن به‌صورت خودکار روی حالت روشن قرار می‌گیرند.</p>
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
   {APPEARANCE_PRESETS.map(preset=>{
    const selected=settings.primary.toLowerCase()===preset.primary.toLowerCase()&&settings.secondary.toLowerCase()===preset.secondary.toLowerCase()&&(!("mode" in preset)||settings.mode===preset.mode);
    return <button key={preset.id} type="button" aria-pressed={selected} onClick={()=>update({primary:preset.primary,secondary:preset.secondary,...("mode" in preset?{mode:preset.mode}:{})})} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-right transition ${selected?"border-chili bg-chili/5 ring-2 ring-chili/15":"border-line bg-surface hover:border-leaf"}`}>
     <span className="flex shrink-0 gap-1.5"><span className="h-9 w-9 rounded-xl border border-black/10" style={{backgroundColor:preset.primary}}/><span className="mt-1 h-7 w-7 rounded-lg border border-black/10" style={{backgroundColor:preset.secondary}}/></span>
     <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{preset.name}</span><span className="mt-1 block text-[11px] leading-5 text-muted">{preset.description}</span></span>
     {selected?<span className="shrink-0 text-xs font-bold text-leaf">انتخاب‌شده</span>:null}
    </button>;
   })}
  </div>
 </div>
 <div className="grid gap-3 sm:grid-cols-2">
 <Field label="رنگ اصلی"><div className="flex items-center gap-3"><input aria-label="رنگ اصلی" type="color" value={settings.primary} onChange={e=>update({primary:e.target.value})} className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-surface p-1"/><span className="text-xs text-muted">{settings.primary}</span></div></Field>
 <Field label="رنگ مکمل"><div className="flex items-center gap-3"><input aria-label="رنگ مکمل" type="color" value={settings.secondary} onChange={e=>update({secondary:e.target.value})} className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-surface p-1"/><span className="text-xs text-muted">{settings.secondary}</span></div></Field>
 <Field label="حالت نمایش"><select className={inputCls} value={settings.mode} onChange={e=>update({mode:e.target.value as AppearanceSettings["mode"]})}><option value="light">روشن</option><option value="dark">تیره</option></select></Field>
 <Field label="فونت سراسری"><div className={inputCls}>IRANYekanWeb FarsiNum — ایران‌یکان فارسی</div></Field>
 <Field label={`اندازه متن: ${settings.fontSize} پیکسل`}><input className="w-full accent-chili" type="range" min="13" max="20" value={settings.fontSize} onChange={e=>update({fontSize:Number(e.target.value)})}/></Field>
 <Field label={`گردی کارت‌ها: ${settings.cardRadius} پیکسل`}><input className="w-full accent-chili" type="range" min="8" max="28" value={settings.cardRadius} onChange={e=>update({cardRadius:Number(e.target.value)})}/></Field>
 <Field label={`گردی دکمه‌ها: ${settings.buttonRadius} پیکسل`}><input className="w-full accent-chili" type="range" min="6" max="24" value={settings.buttonRadius} onChange={e=>update({buttonRadius:Number(e.target.value)})}/></Field>
 <Field label="لوگو (PNG، JPG یا WebP؛ حداکثر ۵۱۲ کیلوبایت)"><input className={inputCls} type="file" accept="image/png,image/jpeg,image/webp" disabled={logoBusy} onChange={e=>{void logo(e.target.files?.[0]);e.currentTarget.value="";}}/></Field>
 </div>
 <div className="rounded-[var(--radius-card)] border border-line bg-bg p-4"><p className="mb-3 text-xs text-muted">پیش‌نمایش زنده</p><div className="flex flex-wrap items-center gap-3">{settings.logoUrl?<img src={settings.logoUrl} alt="پیش‌نمایش لوگو" className="h-12 w-12 rounded-lg object-contain"/>:null}<div className="min-w-0 flex-1"><p className="font-bold">گریل‌کَش | 3Food POS</p><p className="text-xs text-muted">نمونه ظاهر پنل فروشگاه</p></div><span className="rounded-full bg-leaf px-3 py-1 text-xs text-leaf-ink">فعال</span><button type="button" className="rounded-xl bg-chili px-4 py-2 text-sm font-semibold text-chili-ink">دکمه نمونه</button></div></div>
 <div className="flex flex-wrap items-center gap-2"><Btn onClick={()=>void persist()} disabled={busy||logoBusy}>{busy?"در حال ذخیره...":"ذخیره ظاهر برای همه"}</Btn><Btn tone="ghost" onClick={()=>void restore()} disabled={busy||logoBusy}>بازنشانی پیش‌فرض</Btn>{logoBusy?<span className="text-xs text-muted">در حال بارگذاری لوگو...</span>:null}</div>
 {note?<p className="text-sm text-muted" role="status">{note}</p>:null}</Card>;
}
