import { useEffect, useState, type FormEvent } from "react";
import { Btn, Card, Empty, Field, PageHeading, inputCls } from "./bits";
import { money, uid } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";
import { phpApi } from "@/lib/api/php-client";
import { tehranDate, isoToJalali, jalaliToIso } from "@/lib/iranian-date";
import { createXlsxBlob } from "@/lib/xlsx-export";

type ExpenseCategory = { id: string; name: string; active?: boolean };
type ReportsScreenProps = {
  loadCategories: () => Promise<ExpenseCategory[]>;
  saveRecord: <T extends { id: string | number }>(resource: string, item: T, commit: () => void) => Promise<boolean>;
  deleteRecord: (resource: string, id: string, commit: () => void) => Promise<boolean>;
};

const REPORT_INITIAL_TO = tehranDate();
const REPORT_INITIAL_FROM = tehranDate(Date.now() - 6 * 86400000);

export function ReportsScreen({ loadCategories, saveRecord, deleteRecord }: ReportsScreenProps) {
  const expenses = usePos((s) => s.expenses);
  const addExpense = usePos((s) => s.addExpense);
  const saveExpense = usePos((s) => s.saveExpense);
  const removeExpense = usePos((s) => s.removeExpense);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [cat, setCat] = useState("");
  const [note, setNote] = useState("");
  const [expenseDate,setExpenseDate]=useState(tehranDate());
  const [expenseDateText,setExpenseDateText]=useState(()=>isoToJalali(tehranDate()));
  const initialFrom=REPORT_INITIAL_FROM;
  const initialTo=REPORT_INITIAL_TO;
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [fromText,setFromText]=useState(()=>isoToJalali(initialFrom));
  const [toText,setToText]=useState(()=>isoToJalali(initialTo));
  const [newCategory, setNewCategory] = useState("");
  const [expenseFilterCategory, setExpenseFilterCategory] = useState("all");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [serverSummary, setServerSummary] = useState<Record<string, unknown> | null>(null);
  const [reportError, setReportError] = useState("");
  useEffect(() => {
    let active = true;
    void loadCategories()
      .then(items => { if(active){setCategories(items);setCat(items.find(x=>x.active!==false)?.name??"");} })
      .catch(() => { if(active) setCategories([]); });
    return () => { active=false; };
  }, []);
  useEffect(() => { let active=true; void phpApi.getReportSummary(from,to).then(r=>{if(active){setServerSummary(r);setReportError("");}}).catch(e=>{if(active){setServerSummary(null);setReportError(e instanceof Error?e.message:"گزارش سرور دریافت نشد");}}); return ()=>{active=false;}; },[from,to]);
  // Category totals come from the same server-side, date-scoped summary as
  // sales and expenses; the browser cache is only used for editing workflows.
  const serverExpenseGroups = serverSummary?.expense_categories && typeof serverSummary.expense_categories === "object"
    ? serverSummary.expense_categories as Record<string, number>
    : {};
  const expenseByCategory = Object.entries(serverExpenseGroups)
    .filter(([name]) => expenseFilterCategory === "all" || name === expenseFilterCategory)
    .sort(([left], [right]) => left.localeCompare(right, "fa"));
  // Financial reporting must never silently fall back to a partial browser snapshot.
  const reportSales = typeof serverSummary?.sales === "number" ? serverSummary.sales : 0;
  const reportCost = typeof serverSummary?.cost_of_goods === "number" ? serverSummary.cost_of_goods : 0;
  const reportExpenses = typeof serverSummary?.expenses === "number" ? serverSummary.expenses : 0;
  const reportNet = typeof serverSummary?.net_profit === "number" ? serverSummary.net_profit : 0;
  const reportTax = typeof serverSummary?.tax_collected === "number" ? serverSummary.tax_collected : 0;
  const reportDiscounts = typeof serverSummary?.discounts === "number" ? serverSummary.discounts : 0;
  const reportOrders = typeof serverSummary?.orders === "number" ? serverSummary.orders : 0;
  const reportCancelled = typeof serverSummary?.cancelled === "number" ? serverSummary.cancelled : 0;
  const inventoryPurchases = typeof serverSummary?.inventory_purchases === "number" ? serverSummary.inventory_purchases : 0;
  const dailyRows: [string,number][] = Array.isArray(serverSummary?.daily) ? (serverSummary.daily as {date:string;sales:number}[]).map(row=>[row.date,row.sales] as [string,number]) : [];
  const serverPayments = serverSummary?.payments && typeof serverSummary.payments === "object"
    ? serverSummary.payments as Record<string, unknown>
    : null;
  const payments=["cash","card","online"].map(method=>({
    method,
    label:method==="cash"?"نقدی":method==="card"?"کارت‌خوان":"آنلاین",
    amount:typeof serverPayments?.[method] === "number"
      ? serverPayments[method] as number
      : 0,
  }));
  const monthlyRows = Array.isArray(serverSummary?.monthly) ? serverSummary.monthly as {month:string;sales:number}[] : [];
  const productCategoryRows = Array.isArray(serverSummary?.product_categories) ? serverSummary.product_categories as {name:string;quantity:number;revenue:number}[] : [];
  const lowStockRows = Array.isArray(serverSummary?.low_stock) ? serverSummary.low_stock as {name:string;stock:number;minStock:number;unit:string}[] : [];
  const topCustomerRows = Array.isArray(serverSummary?.top_customers) ? serverSummary.top_customers as {name:string;phone:string;totalSpent:number;visits:number;points:number}[] : [];
  const allProductRows = Array.isArray(serverSummary?.all_products) ? serverSummary.all_products as {name:string;quantity:number;revenue:number}[] : [];
  const topReportRows = allProductRows.slice(0,10);
  const inventoryRows = Array.isArray(serverSummary?.inventory_items) ? serverSummary.inventory_items as {name:string;stock:number;minStock:number;unit:string;costPerUnit:number;value:number}[] : [];
  const inventoryConsumptionRows = Array.isArray(serverSummary?.inventory_consumption) ? serverSummary.inventory_consumption as {ingredient_id:string;name:string;quantity:number;unit:string}[] : [];
  const allCustomerRows = Array.isArray(serverSummary?.all_customers) ? serverSummary.all_customers as {name:string;phone:string;totalSpent:number;visits:number;points:number}[] : [];
  const expenseItemRows = Array.isArray(serverSummary?.expense_items) ? serverSummary.expense_items as {title:string;category:string;date:string;amount:number}[] : [];
  const visibleExpenseItemRows = expenseItemRows.filter(row => expenseFilterCategory === "all" || row.category === expenseFilterCategory);
  const visibleExpenses = expenses.filter(item => expenseFilterCategory === "all" || item.category === expenseFilterCategory);
  const grossProfit = typeof serverSummary?.gross_profit === "number" ? serverSummary.gross_profit : reportSales - reportCost;
  async function refreshServerReport(){
    try{const result=await phpApi.getReportSummary(from,to);setServerSummary(result);setReportError("");}
    catch(error){setServerSummary(null);setReportError(error instanceof Error?error.message:"گزارش سرور دریافت نشد");}
  }
  function downloadExcel(){
    const rows=[["نوع","عنوان","تعداد / جزئیات","مبلغ"],["فروش","جمع فروش خالص","",String(reportSales)],["سود و زیان","بهای تمام‌شده","",String(reportCost)],["سود و زیان","سود ناخالص","",String(grossProfit)],["سود و زیان","هزینه‌های عملیاتی","",String(reportExpenses)],["سود و زیان","سود خالص","",String(reportNet)],["مالی","تخفیف‌ها","",String(reportDiscounts)],["مالی","مالیات وصول‌شده","",String(reportTax)],["انبار","خرید مواد اولیه","",String(inventoryPurchases)],...dailyRows.map(([day,value])=>["روزانه",day,"",String(value)]),...monthlyRows.map(row=>["ماهانه",row.month,"",String(row.sales)]),...allProductRows.map(row=>["محصول",row.name,String(row.quantity),String(row.revenue)]),...productCategoryRows.map(row=>["دسته محصول",row.name,String(row.quantity),String(row.revenue)]),...payments.map(p=>["پرداخت",p.label,"",String(p.amount)]),...allCustomerRows.map(row=>["مشتری",row.name,row.phone,String(row.totalSpent)]),...expenseByCategory.map(([name,value])=>["هزینه بر اساس دسته",name,"",String(value)]),...visibleExpenseItemRows.map(row=>["ریز هزینه",row.title,`${row.category} · ${row.date}`,String(row.amount)]),...inventoryRows.map(row=>["انبار",row.name,`${row.stock} / حداقل ${row.minStock} ${row.unit}`,String(row.value)]),...inventoryConsumptionRows.map(row=>["مصرف مواد اولیه",row.name,`${row.quantity} ${row.unit}`,""])];
    const url=URL.createObjectURL(createXlsxBlob(rows));
    const a=document.createElement("a");a.href=url;a.download="3food-pos-report.xlsx";a.click();URL.revokeObjectURL(url);
  }
  async function createCategory(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const name=newCategory.trim();if(!name||categoryBusy)return;setCategoryBusy(true);
    const item={id:uid("expense_cat"),name,active:true};
    const ok=await saveRecord("expense_categories",item,()=>setCategories(old=>[...old,item]));
    if(ok){setNewCategory("");setCat(name);}setCategoryBusy(false);
  }
  async function editCategory(category:{id:string;name:string;active?:boolean}){
    const name=window.prompt("ویرایش نام دسته هزینه",category.name);if(name===null||!name.trim())return;
    const updated={...category,name:name.trim()};
    if(categories.some(item=>item.id!==category.id&&item.name===updated.name)){window.alert("دسته‌ای با این نام وجود دارد.");return;}
    const ok=await saveRecord("expense_categories",updated,()=>{
      setCategories(old=>old.map(c=>c.id===category.id?updated:c));
      expenses.filter(item=>item.category===category.name).forEach(item=>saveExpense({...item,category:updated.name}));
    });
    if(ok){
      if(cat===category.name)setCat(updated.name);
      if(expenseFilterCategory===category.name)setExpenseFilterCategory(updated.name);
      await refreshServerReport();
    }
  }
  async function deleteCategory(category:{id:string;name:string;active?:boolean}){
    if(expenses.some(e=>e.category===category.name)){window.alert("این دسته در سوابق هزینه استفاده شده است؛ ابتدا هزینه‌های مرتبط را به دسته دیگری منتقل کنید.");return;}
    if(!window.confirm("دسته «"+category.name+"» حذف شود؟"))return;
    await deleteRecord("expense_categories",category.id,()=>setCategories(old=>old.filter(c=>c.id!==category.id)));
  }
  async function editExpense(expense:typeof expenses[number]){
    const title=window.prompt("شرح هزینه",expense.title);if(title===null||!title.trim())return;
    const raw=window.prompt("مبلغ هزینه (تومان)",String(expense.amount));if(raw===null)return;
    const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0){window.alert("مبلغ معتبر نیست.");return;}
    const updated={...expense,title:title.trim(),amount};
    if(await saveRecord("expenses",updated,()=>saveExpense(updated))) await refreshServerReport();
  }
  async function deleteExpense(expense:typeof expenses[number]){
    if(!window.confirm("هزینه «"+expense.title+"» حذف شود؟"))return;
    if(await deleteRecord("expenses",expense.id,()=>removeExpense(expense.id))) await refreshServerReport();
  }
  async function addCost(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!title.trim()||amount<=0||!cat)return;
    const item={id:uid("ex"),title:title.trim(),amount,category:cat,date:expenseDate,note:note.trim(),createdAt:new Date().toISOString()};
    const ok=await saveRecord("expenses",item,()=>addExpense(item));
    if(ok){setTitle("");setAmount(0);setNote("");setExpenseDate(tehranDate());setExpenseDateText(isoToJalali(tehranDate()));await refreshServerReport();}
  }
  return (
    <div id="print-root" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden"><PageHeading title="مرکز گزارش‌گیری و هزینه‌ها" description="عملکرد فروش، سود و زیان، موجودی و هزینه‌های کسب‌وکار را تحلیل کنید." /><div className="flex gap-2"><Btn tone="ghost" onClick={downloadExcel} disabled={!serverSummary}>خروجی Excel</Btn><Btn onClick={()=>window.print()} disabled={!serverSummary}>چاپ / ذخیره PDF</Btn></div></div>
      <Card className="grid gap-2 sm:grid-cols-2 print:hidden"><Field label="از تاریخ شمسی"><input className={inputCls} inputMode="numeric" placeholder="۱۴۰۵/۰۱/۰۱" value={fromText} onChange={e=>{setFromText(e.target.value);const parsed=jalaliToIso(e.target.value);if(parsed)setFrom(parsed);}} onBlur={()=>{if(!jalaliToIso(fromText))setFromText(isoToJalali(from));}}/></Field><Field label="تا تاریخ شمسی"><input className={inputCls} inputMode="numeric" placeholder="۱۴۰۵/۰۱/۰۷" value={toText} onChange={e=>{setToText(e.target.value);const parsed=jalaliToIso(e.target.value);if(parsed)setTo(parsed);}} onBlur={()=>{if(!jalaliToIso(toText))setToText(isoToJalali(to));}}/></Field></Card>
      {reportError?<p className="text-xs text-warn">گزارش زنده سرور در دسترس نیست: {reportError}</p>:null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-muted">فروش خالص سفارش‌ها</p><p className="text-lg font-bold">{money(reportSales)}</p></Card>
        <Card><p className="text-xs text-muted">بهای تمام‌شده</p><p className="text-lg font-bold">{money(reportCost)}</p></Card>
        <Card><p className="text-xs text-muted">هزینه‌های ثبت‌شده</p><p className="text-lg font-bold">{money(reportExpenses)}</p></Card>
        <Card><p className="text-xs text-muted">سود پس از هزینه‌ها</p><p className="text-lg font-bold">{money(reportNet)}</p></Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-muted">تعداد سفارش‌های معتبر</p><p className="text-lg font-bold">{reportOrders.toLocaleString("fa-IR")}</p></Card>
        <Card><p className="text-xs text-muted">سفارش‌های لغوشده</p><p className="text-lg font-bold">{reportCancelled.toLocaleString("fa-IR")}</p></Card>
        <Card><p className="text-xs text-muted">تخفیف‌ها</p><p className="text-lg font-bold">{money(reportDiscounts)}</p></Card>
        <Card><p className="text-xs text-muted">مالیات وصول‌شده</p><p className="text-lg font-bold">{money(reportTax)}</p></Card>
      </div>
      <Card><h3 className="mb-3 font-semibold">نمودار فروش روزانه</h3>{dailyRows.length?<div className="space-y-3">{dailyRows.map(([day,total])=><div key={day} className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2 text-xs"><span>{new Date(day+"T12:00:00").toLocaleDateString("fa-IR",{month:"short",day:"numeric"})}</span><div className="h-3 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-leaf" style={{width:`${Math.max(1,total/Math.max(1,...dailyRows.map(row=>row[1]))*100)}%`}}/></div><b>{money(total)}</b></div>)}</div>:<Empty text="در این بازه سفارشی وجود ندارد"/>}</Card>
      <Card><h3 className="mb-3 font-semibold">نمودار فروش ماهانه</h3>{monthlyRows.length?<div className="space-y-3">{monthlyRows.map(row=><div key={row.month} className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2 text-xs"><span>{row.month}</span><div className="h-3 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-leaf" style={{width:`${Math.max(1,row.sales/Math.max(1,...monthlyRows.map(item=>item.sales))*100)}%`}}/></div><b>{money(row.sales)}</b></div>)}</div>:<Empty text="داده ماهانه‌ای در این بازه وجود ندارد"/>}</Card>
      <Card><h3 className="mb-2 font-semibold">وضعیت انبار</h3><p className="text-sm">ارزش تقریبی موجودی: {money(Number((serverSummary?.inventory as {value?:number}|undefined)?.value??0))}</p><p className="text-sm">مواد اولیه زیر حد هشدار: {lowStockRows.length.toLocaleString("fa-IR")}</p>{lowStockRows.map(row=><p key={row.name} className="flex justify-between text-sm"><span>{row.name}</span><span>{row.stock} / حداقل {row.minStock} {row.unit}</span></p>)}</Card>
      <Card><h3 className="mb-2 font-semibold">مصرف مواد اولیه در بازه گزارش</h3>{inventoryConsumptionRows.length?inventoryConsumptionRows.map(row=><p key={row.ingredient_id} className="flex flex-wrap justify-between gap-2 border-b border-line py-1 text-sm"><span>{row.name}</span><b>{row.quantity.toLocaleString("fa-IR")} {row.unit}</b></p>):<Empty text="مصرف ثبت‌شده‌ای در این بازه وجود ندارد"/>}<p className="mt-2 text-xs text-muted">مقادیر از دفتر تراکنش سفارش‌ها محاسبه شده و سفارش‌های لغوشده یا اثرهای برگشت‌خورده در آن شمرده نمی‌شوند.</p></Card>
      <Card><h3 className="mb-2 font-semibold">مشتریان برتر بر اساس مجموع خرید</h3>{topCustomerRows.map(row=><p key={row.phone} className="flex flex-wrap justify-between gap-2 border-b border-line py-1 text-sm"><span>{row.name} · {row.phone}</span><b>{money(row.totalSpent)}</b></p>)}</Card>
      <Card><h3 className="mb-2 font-semibold">فروش بر اساس دسته‌بندی محصول</h3>{productCategoryRows.length?productCategoryRows.map(row=><p key={row.name} className="flex justify-between border-b border-line py-1 text-sm"><span>{row.name} · {row.quantity.toLocaleString("fa-IR")} عدد</span><b>{money(row.revenue)}</b></p>):<Empty text="فروشی در دسته‌ها ثبت نشده است"/>}</Card>
      <Card><h3 className="mb-3 font-semibold">نمودار محصولات پرفروش</h3>{topReportRows.length?<div className="space-y-3">{topReportRows.map((row)=><div key={row.name} className="grid grid-cols-[minmax(90px,1fr)_minmax(0,2fr)_auto] items-center gap-2 text-xs"><span className="truncate">{row.name}</span><div className="h-3 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-leaf" style={{width:`${Math.max(1,row.quantity/Math.max(1,...topReportRows.map(item=>item.quantity))*100)}%`}}/></div><b>{row.quantity.toLocaleString("fa-IR")} عدد</b></div>)}</div>:<Empty text="فروشی ثبت نشده است"/>}</Card>
      <Card><h3 className="mb-3 font-semibold">نمودار روش‌های پرداخت</h3><div className="space-y-3">{payments.map(p=><div key={p.method} className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-2 text-xs"><span>{p.label}</span><div className="h-3 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-leaf" style={{width:`${Math.max(0,p.amount/Math.max(1,...payments.map(item=>item.amount))*100)}%`}}/></div><b>{money(p.amount)}</b></div>)}</div></Card>
      <Card><h3 className="mb-2 font-semibold">هزینه‌ها بر اساس دسته</h3>{expenseByCategory.map(([name,value])=><p key={name} className="flex justify-between py-1 text-sm"><span>{name}</span><b>{money(value)}</b></p>)}<p className="mt-2 border-t border-line pt-2 text-xs text-muted">خرید مواد اولیه (سرمایه‌گذاری موجودی، خارج از هزینه عملیاتی سود و زیان): {money(inventoryPurchases)}</p></Card>
      <Card className="print:hidden"><h3 className="mb-3 font-semibold">ثبت هزینه جدید</h3><p className="mb-2 text-xs text-muted">برای خرید مواد اولیه که باید موجودی انبار را افزایش دهد، از بخش تأمین‌کنندگان استفاده کن؛ ثبت هزینه به‌تنهایی موجودی را تغییر نمی‌دهد.</p><form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>void addCost(e)}>
        <Field label="شرح هزینه"><input className={inputCls} value={title} onChange={e=>setTitle(e.target.value)} required/></Field>
        <Field label="مبلغ (تومان)"><input className={inputCls} type="number" min="1" value={amount||""} onChange={e=>setAmount(Number(e.target.value))} required/></Field>
        <Field label="تاریخ هزینه شمسی"><input className={inputCls} inputMode="numeric" placeholder="۱۴۰۵/۰۱/۰۱" value={expenseDateText} onChange={e=>{setExpenseDateText(e.target.value);const parsed=jalaliToIso(e.target.value);if(parsed)setExpenseDate(parsed);}} onBlur={()=>{if(!jalaliToIso(expenseDateText))setExpenseDateText(isoToJalali(expenseDate));}} required/></Field>
        <Field label="دسته‌بندی"><select className={inputCls} value={cat} onChange={e=>setCat(e.target.value)} required>{categories.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
        <Field label="توضیحات"><input className={inputCls} value={note} onChange={e=>setNote(e.target.value)}/></Field>
        <div><Btn type="submit">ثبت هزینه</Btn></div>
      </form></Card>
      <Card className="print:hidden"><h3 className="mb-2 font-semibold">افزودن دسته هزینه</h3><form className="flex gap-2" onSubmit={e=>void createCategory(e)}><input className={inputCls} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="نام دسته جدید" required/><Btn type="submit" disabled={categoryBusy}>افزودن</Btn></form><div className="mt-3 space-y-2">{categories.map(c=><div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"><span>{c.name}</span><span className="flex gap-1"><Btn tone="ghost" onClick={()=>void editCategory(c)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void deleteCategory(c)}>حذف</Btn></span></div>)}</div></Card>
      <Card><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">سوابق هزینه‌ها</h3><select className={`${inputCls} max-w-64 print:hidden`} value={expenseFilterCategory} onChange={e=>setExpenseFilterCategory(e.target.value)}><option value="all">همه دسته‌ها</option>{categories.map(category=><option key={category.id} value={category.name}>{category.name}</option>)}</select></div>{visibleExpenses.map(e=><div key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 text-sm"><span>{e.title} · {e.category} · {new Date(e.date+"T12:00:00").toLocaleDateString("fa-IR")}</span><span className="flex items-center gap-2"><b>{money(e.amount)}</b><Btn tone="ghost" onClick={()=>void editExpense(e)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void deleteExpense(e)}>حذف</Btn></span></div>)}</Card>
    </div>
  );
}


