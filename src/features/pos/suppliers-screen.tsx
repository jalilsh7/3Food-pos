import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Btn, Card, Field, PageHeading, inputCls } from "./bits";
import { money, uid } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";
import { phpApi } from "@/lib/api/php-client";
import { tehranDate } from "@/lib/pos/formatters";

type Supplier={id:string;name:string;phone:string;contact:string;notes:string;balance:number;active:boolean};
type InvoiceLine={ingredientId:string;quantity:number;unitCost:number};
type Purchase={id:string;supplierId:string;title:string;amount:number;date:string;paid:number;note:string;kind?:string;items?:Array<{ingredientId:string;ingredientName?:string;quantity:number;unitCost:number;unit?:string}>;invoiceNumber?:string;ingredientId?:string;quantity?:number;unitCost?:number};

export function SuppliersScreen({ saveCentralRecord, onPurchaseSaved }: { saveCentralRecord: <T extends { id: string | number }>(resource: string, item: T, apply: () => void) => Promise<boolean>; onPurchaseSaved: () => Promise<void> }){
  const ingredients=usePos((s)=>s.ingredients);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [purchases,setPurchases]=useState<Purchase[]>([]);
  const [draft,setDraft]=useState({name:"",phone:"",contact:"",notes:""});
  const [purchase,setPurchase]=useState({supplierId:"",title:"",invoiceNumber:"",paid:0,note:""});
  const [lines,setLines]=useState<InvoiceLine[]>([{ingredientId:"",quantity:0,unitCost:0}]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const total=useMemo(()=>lines.reduce((sum,line)=>sum+Math.round(line.quantity*line.unitCost),0),[lines]);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{const [a,b]=await Promise.all([phpApi.listRecords<Supplier>("suppliers"),phpApi.listRecords<Purchase>("supplier_purchases")]);setSuppliers(a.items);setPurchases(b.items);}catch(e){setError(e instanceof Error?e.message:"دریافت اطلاعات تأمین‌کنندگان انجام نشد");}finally{setBusy(false);}},[]);
  useEffect(()=>{queueMicrotask(()=>{void refresh();});},[refresh]);
  async function addSupplier(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!draft.name.trim())return;const item:Supplier={id:uid("sup"),...draft,name:draft.name.trim(),balance:0,active:true};if(await saveCentralRecord("suppliers",item,()=>setSuppliers(old=>[item,...old])))setDraft({name:"",phone:"",contact:"",notes:""});}
  function updateLine(index:number,patch:Partial<InvoiceLine>){setLines(old=>old.map((line,i)=>i===index?{...line,...patch}:line));}
  async function addPurchase(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!purchase.supplierId||!purchase.title.trim()||lines.some(line=>!line.ingredientId||line.quantity<=0||line.unitCost<=0)||total<=0||purchase.paid<0||purchase.paid>total){setError("اطلاعات فاکتور، اقلام، مقدار، قیمت یا مبلغ پرداختی را بررسی کنید.");return;}
    const supplier=suppliers.find(s=>s.id===purchase.supplierId);if(!supplier)return;
    const invoice={id:uid("inv"),...purchase,title:purchase.title.trim(),invoiceNumber:purchase.invoiceNumber.trim(),amount:total,paid:purchase.paid,note:purchase.note.trim(),date:tehranDate(),items:lines.map(line=>({...line}))};
    setBusy(true);setError("");
    try{const result=await phpApi.createSupplierInvoice<typeof invoice,Supplier>(supplier.id,invoice);setPurchases(old=>[result.item,...old]);setSuppliers(old=>old.map(s=>s.id===supplier.id?result.supplier:s));await onPurchaseSaved();setPurchase({supplierId:"",title:"",invoiceNumber:"",paid:0,note:""});setLines([{ingredientId:"",quantity:0,unitCost:0}]);}
    catch(e){setError(e instanceof Error?e.message:"ثبت فاکتور خرید انجام نشد");}finally{setBusy(false);}
  }
  async function editSupplier(supplier:Supplier){const name=window.prompt("نام تأمین‌کننده",supplier.name);if(name===null||!name.trim())return;const phone=window.prompt("شماره تماس",supplier.phone);if(phone===null)return;const contact=window.prompt("نام رابط",supplier.contact);if(contact===null)return;const updated={...supplier,name:name.trim(),phone:phone.trim(),contact:contact.trim()};await saveCentralRecord("suppliers",updated,()=>setSuppliers(old=>old.map(s=>s.id===supplier.id?updated:s)));}
  async function toggleSupplier(supplier:Supplier){const updated={...supplier,active:!supplier.active};await saveCentralRecord("suppliers",updated,()=>setSuppliers(old=>old.map(s=>s.id===supplier.id?updated:s)));}
  async function settle(supplier:Supplier){if(busy)return;const raw=window.prompt("مبلغ پرداختی برای تسویه (تومان):");if(raw===null)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0||amount>supplier.balance){setError("مبلغ تسویه معتبر نیست.");return;}const item={id:uid("pay"),supplierId:supplier.id,title:"پرداخت/تسویه",amount:0,paid:amount,date:tehranDate(),note:"تسویه حساب",kind:"payment"};setBusy(true);try{const result=await phpApi.createSupplierTransaction<typeof item,Supplier>(supplier.id,item);setSuppliers(old=>old.map(s=>s.id===supplier.id?result.supplier:s));setPurchases(old=>[result.item as Purchase,...old]);}catch(e){setError(e instanceof Error?e.message:"ثبت تسویه انجام نشد");}finally{setBusy(false);}}
  return <div className="space-y-4">
    <PageHeading title="تأمین‌کنندگان و فاکتور خرید" description="تأمین‌کننده‌ها، فاکتورهای چندقلمی، ورود موجودی و مانده‌حساب‌ها را یکجا مدیریت کنید."/>
    {error?<p role="alert" className="text-sm text-warn">{error}</p>:null}
    <Card><h3 className="mb-2 font-semibold">ثبت تأمین‌کننده</h3><form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>void addSupplier(e)}>
      <Field label="نام تأمین‌کننده"><input className={inputCls} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/></Field>
      <Field label="شماره تماس"><input className={inputCls} value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></Field>
      <Field label="نام رابط"><input className={inputCls} value={draft.contact} onChange={e=>setDraft({...draft,contact:e.target.value})}/></Field>
      <Field label="یادداشت"><input className={inputCls} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></Field><div><Btn type="submit">ثبت تأمین‌کننده</Btn></div>
    </form></Card>
    <Card><h3 className="mb-3 font-semibold">ثبت فاکتور خرید</h3><form className="space-y-3" onSubmit={e=>void addPurchase(e)}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="تأمین‌کننده"><select className={inputCls} value={purchase.supplierId} onChange={e=>setPurchase({...purchase,supplierId:e.target.value})} required><option value="">انتخاب کنید</option>{suppliers.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="شماره فاکتور"><input className={inputCls} value={purchase.invoiceNumber} onChange={e=>setPurchase({...purchase,invoiceNumber:e.target.value})} placeholder="اختیاری"/></Field>
        <Field label="عنوان فاکتور"><input className={inputCls} value={purchase.title} onChange={e=>setPurchase({...purchase,title:e.target.value})} placeholder="مثلاً خرید هفتگی مواد اولیه" required/></Field>
        <Field label="مبلغ پرداخت‌شده (تومان)"><input className={inputCls} type="number" min="0" max={total} value={purchase.paid||""} onChange={e=>setPurchase({...purchase,paid:Number(e.target.value)})}/></Field>
      </div>
      <div className="space-y-2"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">اقلام فاکتور و اتصال به انبار</h4><Btn tone="ghost" onClick={()=>setLines(old=>[...old,{ingredientId:"",quantity:0,unitCost:0}])}>افزودن قلم</Btn></div>
        {lines.map((line,index)=><div key={index} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]">
          <Field label="قلم انبار"><select className={inputCls} value={line.ingredientId} onChange={e=>{const ingredient=ingredients.find(x=>x.id===e.target.value);updateLine(index,{ingredientId:e.target.value,unitCost:ingredient?.costPerUnit??0});}} required><option value="">انتخاب ماده اولیه</option>{ingredients.map(x=><option key={x.id} value={x.id}>{x.name} · موجودی {x.stock} {x.unit}</option>)}</select></Field>
          <Field label={"مقدار ("+(ingredients.find(x=>x.id===line.ingredientId)?.unit||"واحد")+")"}><input className={inputCls} type="number" min="0.001" step="0.001" value={line.quantity||""} onChange={e=>updateLine(index,{quantity:Number(e.target.value)})} required/></Field>
          <Field label="قیمت هر واحد (تومان)"><input className={inputCls} type="number" min="1" step="1" value={line.unitCost||""} onChange={e=>updateLine(index,{unitCost:Number(e.target.value)})} required/></Field>
          <div className="flex items-end"><Btn tone="ghost" disabled={lines.length===1} onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))}>حذف</Btn></div>
          <p className="text-xs text-muted sm:col-span-4">جمع این قلم: {money(Math.round(line.quantity*line.unitCost))} تومان</p>
        </div>)}
      </div>
      <Field label="یادداشت فاکتور"><input className={inputCls} value={purchase.note} onChange={e=>setPurchase({...purchase,note:e.target.value})}/></Field>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3"><div><p className="text-xs text-muted">جمع کل فاکتور</p><b className="text-lg">{money(total)} تومان</b></div><div className="text-left"><p className="text-xs text-muted">مانده بدهی این فاکتور</p><b>{money(Math.max(0,total-purchase.paid))} تومان</b></div><Btn type="submit" disabled={busy||total<=0}>ثبت فاکتور و افزایش موجودی</Btn></div>
    </form></Card>
    {suppliers.map(s=><Card key={s.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{s.name}</b><p className="text-xs text-muted">{s.phone} · رابط: {s.contact||"—"}</p></div><div className="text-left"><b>{money(s.balance)} بدهی</b><div className="flex flex-wrap gap-1"><Btn tone="ghost" onClick={()=>void editSupplier(s)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void toggleSupplier(s)}>{s.active?"غیرفعال‌کردن":"فعال‌کردن"}</Btn><Btn tone="ghost" onClick={()=>void settle(s)} disabled={s.balance<=0||busy}>ثبت تسویه</Btn></div></div></div>
      <div className="mt-2 space-y-1 border-t border-line pt-2 text-sm">{purchases.filter(p=>p.supplierId===s.id).map(p=><div key={p.id} className="rounded-lg py-1"><p className="flex flex-wrap justify-between gap-2"><span>{p.title}{p.invoiceNumber?" · فاکتور "+p.invoiceNumber:""} · {new Date(p.date+"T12:00:00").toLocaleDateString("fa-IR",{timeZone:"Asia/Tehran"})}</span><span>{money(p.amount)} / پرداخت {money(p.paid)}</span></p>{p.items?.length?<p className="mt-1 text-xs text-muted">{p.items.map(line=>(line.ingredientName||ingredients.find(i=>i.id===line.ingredientId)?.name||"قلم")+": "+line.quantity+" "+(line.unit||"")+" × "+money(line.unitCost)).join(" · ")}</p>:p.ingredientId&&p.quantity&&p.unitCost?<p className="text-xs text-muted">{p.quantity} × {money(p.unitCost)}</p>:null}</div>)}</div>
    </Card>)}
    {busy?<p className="text-xs text-muted">در حال بارگذاری یا ثبت اطلاعات...</p>:null}
  </div>;
}
