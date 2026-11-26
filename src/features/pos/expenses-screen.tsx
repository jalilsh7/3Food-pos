import { useEffect, useState, type FormEvent } from "react";
import { Btn, Card, Empty, Field, PageHeading, inputCls } from "./bits";
import { money, uid } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";
import { tehranDate } from "@/lib/pos/formatters";
import type { ExpenseCategory } from "./pos-data";

export function ExpensesScreen({ loadCategories, saveRecord, deleteRecord }: {
  loadCategories: () => Promise<ExpenseCategory[]>;
  saveRecord: <T extends { id: string | number }>(resource: string, item: T, commit: () => void) => Promise<boolean>;
  deleteRecord: (resource: string, id: string, commit: () => void) => Promise<boolean>;
}){
  const expenses=usePos((s)=>s.expenses);
  const addExpense=usePos((s)=>s.addExpense);
  const saveExpense=usePos((s)=>s.saveExpense);
  const removeExpense=usePos((s)=>s.removeExpense);
  const [categories,setCategories]=useState<ExpenseCategory[]>([]);
  const [title,setTitle]=useState("");
  const [amount,setAmount]=useState(0);
  const [category,setCategory]=useState("");
  const [date,setDate]=useState(tehranDate());
  const [note,setNote]=useState("");
  const [newCategory,setNewCategory]=useState("");
  const [filter,setFilter]=useState("all");
  useEffect(()=>{let active=true;void loadCategories().then(items=>{if(active){setCategories(items);setCategory(items.find(item=>item.active!==false)?.name??"");}}).catch(()=>{if(active)setCategories([]);});return()=>{active=false;};},[]);
  const visible=expenses.filter(item=>(filter==="all"||item.category===filter)).sort((a,b)=>b.date.localeCompare(a.date));
  const total=visible.reduce((sum,item)=>sum+item.amount,0);
  async function add(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!title.trim()||amount<=0||!category)return;const item={id:uid("ex"),title:title.trim(),amount,category,date,note:note.trim(),createdAt:new Date().toISOString()};const ok=await saveRecord("expenses",item,()=>addExpense(item));if(ok){setTitle("");setAmount(0);setNote("");setDate(tehranDate());}}
  async function addCat(event:FormEvent<HTMLFormElement>){event.preventDefault();const name=newCategory.trim();if(!name||categories.some(item=>item.name===name))return;const item={id:uid("expense_cat"),name,active:true};if(await saveRecord("expense_categories",item,()=>setCategories(old=>[...old,item]))){setNewCategory("");setCategory(name);}}
  async function editCategory(item:ExpenseCategory){
    const name=window.prompt("ویرایش نام دسته هزینه",item.name);if(name===null||!name.trim())return;
    const nextName=name.trim();if(categories.some(category=>category.id!==item.id&&category.name===nextName)){window.alert("دسته‌ای با این نام وجود دارد.");return;}
    const updated={...item,name:nextName};
    const ok=await saveRecord("expense_categories",updated,()=>{
      setCategories(old=>old.map(category=>category.id===item.id?updated:category));
      expenses.filter(expense=>expense.category===item.name).forEach(expense=>saveExpense({...expense,category:nextName}));
    });
    if(ok){if(category===item.name)setCategory(nextName);if(filter===item.name)setFilter(nextName);}
  }
  async function removeCategory(item:ExpenseCategory){
    if(expenses.some(expense=>expense.category===item.name)){window.alert("این دسته در سوابق هزینه استفاده شده است؛ ابتدا هزینه‌های مرتبط را به دسته دیگری منتقل کنید.");return;}
    if(!window.confirm("دسته «"+item.name+"» حذف شود؟"))return;
    if(await deleteRecord("expense_categories",item.id,()=>setCategories(old=>old.filter(category=>category.id!==item.id)))){
      if(category===item.name)setCategory(categories.find(category=>category.id!==item.id&&category.active!==false)?.name??"");
      if(filter===item.name)setFilter("all");
    }
  }
  async function edit(item:typeof expenses[number]){const nextTitle=window.prompt("شرح هزینه",item.title);if(nextTitle===null||!nextTitle.trim())return;const raw=window.prompt("مبلغ (تومان)",String(item.amount));if(raw===null)return;const nextAmount=Number(raw);if(!Number.isFinite(nextAmount)||nextAmount<=0){window.alert("مبلغ معتبر نیست.");return;}const updated={...item,title:nextTitle.trim(),amount:nextAmount};await saveRecord("expenses",updated,()=>saveExpense(updated));}
  async function remove(item:typeof expenses[number]){if(!window.confirm("هزینه «"+item.title+"» حذف شود؟"))return;await deleteRecord("expenses",item.id,()=>removeExpense(item.id));}
  return <div className="space-y-4"><PageHeading title="مدیریت هزینه‌ها" description="ثبت مستقل هزینه‌های جاری، دسته‌بندی و پیگیری مخارج کسب‌وکار."/><div className="grid gap-3 sm:grid-cols-3"><Card><p className="text-xs text-muted">مجموع هزینه‌های نمایش‌داده‌شده</p><p className="text-xl font-bold">{money(total)}</p></Card><Card><p className="text-xs text-muted">تعداد هزینه‌ها</p><p className="text-xl font-bold">{visible.length.toLocaleString("fa-IR")}</p></Card><Card><p className="text-xs text-muted">تعداد دسته‌ها</p><p className="text-xl font-bold">{categories.length.toLocaleString("fa-IR")}</p></Card></div><Card><h3 className="mb-3 font-semibold">ثبت هزینه جدید</h3><form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>void add(e)}><Field label="عنوان هزینه"><input className={inputCls} value={title} onChange={e=>setTitle(e.target.value)} required/></Field><Field label="مبلغ (تومان)"><input className={inputCls} type="number" min="1" value={amount||""} onChange={e=>setAmount(Number(e.target.value))} required/></Field><Field label="تاریخ"><input className={inputCls} type="date" value={date} onChange={e=>setDate(e.target.value)} required/></Field><Field label="دسته‌بندی"><select className={inputCls} value={category} onChange={e=>setCategory(e.target.value)} required>{categories.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></Field><Field label="توضیحات"><input className={inputCls} value={note} onChange={e=>setNote(e.target.value)}/></Field><div className="flex items-end"><Btn type="submit">ثبت هزینه</Btn></div></form></Card><Card><h3 className="mb-2 font-semibold">مدیریت دسته‌بندی‌ها</h3><form className="flex gap-2" onSubmit={e=>void addCat(e)}><input className={inputCls} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="نام دسته جدید"/><Btn type="submit">افزودن</Btn></form><div className="mt-3 space-y-2">{categories.map(item=><div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"><span>{item.name}</span><span className="flex gap-1"><Btn tone="ghost" onClick={()=>void editCategory(item)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void removeCategory(item)}>حذف</Btn></span></div>)}</div></Card><Card><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">سوابق هزینه‌ها</h3><select className={inputCls+" max-w-64"} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">همه دسته‌ها</option>{categories.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></div>{visible.length?visible.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-sm"><div><b>{item.title}</b><p className="text-xs text-muted">{item.category} · {new Date(item.date+"T12:00:00").toLocaleDateString("fa-IR")}{item.note?" · "+item.note:""}</p></div><div className="flex items-center gap-2"><b>{money(item.amount)}</b><Btn tone="ghost" onClick={()=>void edit(item)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void remove(item)}>حذف</Btn></div></div>):<Empty text="هنوز هزینه‌ای ثبت نشده است."/>}</Card></div>;
}


