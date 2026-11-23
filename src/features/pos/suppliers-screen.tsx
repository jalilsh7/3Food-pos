import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Btn, Card, Empty, Field, PageHeading, inputCls } from "./bits";
import { money, uid } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";
import { phpApi } from "@/lib/api/php-client";
import { tehranDate } from "@/lib/pos/formatters";

export function SuppliersScreen({ saveCentralRecord, onPurchaseSaved }: { saveCentralRecord: (resource: string, item: unknown, apply: () => void) => Promise<boolean>; onPurchaseSaved: () => Promise<void> }){
  type Supplier={id:string;name:string;phone:string;contact:string;notes:string;balance:number;active:boolean};
  type Purchase={id:string;supplierId:string;title:string;amount:number;date:string;paid:number;note:string;kind?:string;ingredientId?:string;quantity?:number;unitCost?:number};
  const ingredients=usePos((s)=>s.ingredients);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [purchases,setPurchases]=useState<Purchase[]>([]);
  const [draft,setDraft]=useState({name:"",phone:"",contact:"",notes:""});
  const [purchase,setPurchase]=useState({supplierId:"",title:"",amount:0,paid:0,note:"",ingredientId:"",quantity:0,unitCost:0});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [supplierResult, purchaseResult] = await Promise.all([
        phpApi.listRecords<Supplier>("suppliers"),
        phpApi.listRecords<Purchase>("supplier_purchases"),
      ]);
      setSuppliers(supplierResult.items);
      setPurchases(purchaseResult.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت اطلاعات تأمین‌کنندگان انجام نشد");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  async function addSupplier(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!draft.name.trim())return;
    const item:Supplier={id:uid("sup"),...draft,name:draft.name.trim(),balance:0,active:true};
    if(await saveCentralRecord("suppliers",item,()=>setSuppliers(old=>[item,...old])))setDraft({name:"",phone:"",contact:"",notes:""});
  }
  async function addPurchase(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const total=purchase.ingredientId?Math.round(purchase.quantity*purchase.unitCost):purchase.amount;
    if(!purchase.supplierId||!purchase.title.trim()||total<=0||purchase.paid<0||purchase.paid>total||(purchase.ingredientId&&(purchase.quantity<=0||purchase.unitCost<=0)))return;
    const supplier=suppliers.find(s=>s.id===purchase.supplierId);if(!supplier)return;
    const item:Purchase={id:uid("pur"),...purchase,amount:total,title:purchase.title.trim(),date:tehranDate(),note:purchase.note.trim()};
    setBusy(true);
    try{
      const result=await phpApi.createSupplierTransaction<Purchase & {kind:string},Supplier>(supplier.id,{...item,kind:"purchase"});
      setPurchases(old=>[result.item,...old]);setSuppliers(old=>old.map(s=>s.id===supplier.id?result.supplier:s));await onPurchaseSaved();setPurchase({supplierId:"",title:"",amount:0,paid:0,note:"",ingredientId:"",quantity:0,unitCost:0});
    }catch(e){setError(e instanceof Error?e.message:"ثبت خرید انجام نشد");}
    finally{setBusy(false);}
  }
  async function editSupplier(supplier:Supplier){
    const name=window.prompt("نام تأمین‌کننده",supplier.name);if(name===null||!name.trim())return;
    const phone=window.prompt("شماره تماس",supplier.phone);if(phone===null)return;
    const contact=window.prompt("نام رابط",supplier.contact);if(contact===null)return;
    const updated={...supplier,name:name.trim(),phone:phone.trim(),contact:contact.trim()};
    await saveCentralRecord("suppliers",updated,()=>setSuppliers(old=>old.map(s=>s.id===supplier.id?updated:s)));
  }
  async function toggleSupplier(supplier:Supplier){
    const updated={...supplier,active:!supplier.active};
    await saveCentralRecord("suppliers",updated,()=>setSuppliers(old=>old.map(s=>s.id===supplier.id?updated:s)));
  }
  async function settle(supplier:Supplier){
    if(busy)return;
    const raw=window.prompt("مبلغ پرداختی برای تسویه (تومان):");if(raw===null)return;
    const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0||amount>supplier.balance){setError("مبلغ تسویه معتبر نیست.");return;}
    const item={id:uid("pay"),supplierId:supplier.id,title:"پرداخت/تسویه",amount:0,paid:amount,date:tehranDate(),note:"تسویه حساب",kind:"payment"};
    setBusy(true);
    try{const result=await phpApi.createSupplierTransaction<typeof item,Supplier>(supplier.id,item);setSuppliers(old=>old.map(s=>s.id===supplier.id?result.supplier:s));setPurchases(old=>[result.item as Purchase,...old]);}
    catch(e){setError(e instanceof Error?e.message:"ثبت تسویه انجام نشد");}
    finally{setBusy(false);}
  }
  return <div className="space-y-4"><PageHeading title="مدیریت تأمین‌کنندگان" description="تأمین‌کننده‌ها، خریدها و مانده‌حساب‌ها را پیگیری کنید." />{error?<p className="text-sm text-warn">{error}</p>:null}
    <Card><h3 className="mb-2 font-semibold">ثبت تأمین‌کننده</h3><form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>void addSupplier(e)}>
      <Field label="نام تأمین‌کننده"><input className={inputCls} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/></Field>
      <Field label="شماره تماس"><input className={inputCls} value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></Field>
      <Field label="نام رابط"><input className={inputCls} value={draft.contact} onChange={e=>setDraft({...draft,contact:e.target.value})}/></Field>
      <Field label="یادداشت"><input className={inputCls} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></Field><div><Btn type="submit">ثبت تأمین‌کننده</Btn></div>
    </form></Card>
    <Card><h3 className="mb-2 font-semibold">ثبت فاکتور خرید / بدهی</h3><form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>void addPurchase(e)}>
      <Field label="تأمین‌کننده"><select className={inputCls} value={purchase.supplierId} onChange={e=>setPurchase({...purchase,supplierId:e.target.value})} required><option value="">انتخاب کنید</option>{suppliers.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="شرح خرید"><input className={inputCls} value={purchase.title} onChange={e=>setPurchase({...purchase,title:e.target.value})} required/></Field>
      <Field label="ماده اولیه (اختیاری؛ برای ورود به انبار)"><select className={inputCls} value={purchase.ingredientId} onChange={e=>{const ingredient=ingredients.find(x=>x.id===e.target.value);setPurchase({...purchase,ingredientId:e.target.value,title:ingredient?purchase.title||ingredient.name:purchase.title,unitCost:ingredient?.costPerUnit??purchase.unitCost});}}><option value="">خرید غیرانبار / سایر</option>{ingredients.map(x=><option key={x.id} value={x.id}>{x.name} — موجودی {x.stock} {x.unit}</option>)}</select></Field>
      {purchase.ingredientId?<><Field label="مقدار ورودی"><input className={inputCls} type="number" min="0.001" step="0.001" value={purchase.quantity||""} onChange={e=>{const quantity=Number(e.target.value);setPurchase({...purchase,quantity,amount:Math.round(quantity*purchase.unitCost)});}} required/></Field><Field label="قیمت خرید هر واحد"><input className={inputCls} type="number" min="1" value={purchase.unitCost||""} onChange={e=>{const unitCost=Number(e.target.value);setPurchase({...purchase,unitCost,amount:Math.round(purchase.quantity*unitCost)});}} required/></Field></>:null}
      <Field label="مبلغ کل (تومان)"><input className={inputCls} type="number" min="1" value={(purchase.ingredientId?Math.round(purchase.quantity*purchase.unitCost):purchase.amount)||""} onChange={e=>setPurchase({...purchase,amount:Number(e.target.value)})} disabled={!!purchase.ingredientId} required/></Field>
      <Field label="پرداخت‌شده"><input className={inputCls} type="number" min="0" value={purchase.paid||""} onChange={e=>setPurchase({...purchase,paid:Number(e.target.value)})}/></Field>
      <Field label="یادداشت"><input className={inputCls} value={purchase.note} onChange={e=>setPurchase({...purchase,note:e.target.value})}/></Field><div><Btn type="submit" disabled={busy}>ثبت خرید</Btn></div>
    </form></Card>
    {suppliers.map(s=><Card key={s.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{s.name}</b><p className="text-xs text-muted">{s.phone} · رابط: {s.contact||"—"}</p></div><div className="text-left"><b>{money(s.balance)} بدهی</b><div className="flex gap-1"><Btn tone="ghost" onClick={()=>void editSupplier(s)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void toggleSupplier(s)}>{s.active?"غیرفعال‌کردن":"فعال‌کردن"}</Btn><Btn tone="ghost" onClick={()=>void settle(s)} disabled={s.balance<=0}>ثبت تسویه</Btn></div></div></div>
      <div className="mt-2 border-t border-line pt-2 text-sm">{purchases.filter(p=>p.supplierId===s.id).map(p=><p key={p.id} className="flex justify-between"><span>{p.title} · {new Date(p.date+"T12:00:00").toLocaleDateString("fa-IR",{timeZone:"Asia/Tehran"})}{p.quantity&&p.unitCost?` · ${p.quantity} × ${money(p.unitCost)}`:""}</span><span>{money(p.amount)} / پرداخت {money(p.paid)}</span></p>)}</div></Card>)}
    {busy?<p className="text-xs text-muted">در حال بارگذاری...</p>:null}
  </div>;
}

