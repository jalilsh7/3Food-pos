import { useEffect, useState, type FormEvent } from "react";
import { Btn, Card, Empty, Field, PageHeading, inputCls } from "./bits";
import { money, uid } from "@/lib/pos/model";
import { usePos } from "@/lib/pos/store";
import { tehranDate } from "@/lib/pos/formatters";

type ExpenseCategory = { id: string; name: string; active?: boolean };

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
  async function addCat(event:FormEvent<HTMLFormElement>){event.preventDefault();const name=newCategory.trim();if(!name||categories.some(item=>item.name===name))return;const item={id:uid("expense_cat"),name,active:true};if(await saveCentralRecord("expense_categories",item,()=>setCategories(old=>[...old,item]))){setNewCategory("");setCategory(name);}}
  async function editCategory(item:ExpenseCategory){
    const name=window.prompt("ویرایش نام دسته هزینه",item.name);if(name===null||!name.trim())return;
    const nextName=name.trim();if(categories.some(category=>category.id!==item.id&&category.name===nextName)){window.alert("دسته‌ای با این نام وجود دارد.");return;}
    const updated={...item,name:nextName};
    const ok=await saveCentralRecord("expense_categories",updated,()=>{
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
  async function edit(item:typeof expenses[number]){const nextTitle=window.prompt("شرح هزینه",item.title);if(nextTitle===null||!nextTitle.trim())return;const raw=window.prompt("مبلغ (تومان)",String(item.amount));if(raw===null)return;const nextAmount=Number(raw);if(!Number.isFinite(nextAmount)||nextAmount<=0){window.alert("مبلغ معتبر نیست.");return;}const updated={...item,title:nextTitle.trim(),amount:nextAmount};await saveCentralRecord("expenses",updated,()=>saveExpense(updated));}
  async function remove(item:typeof expenses[number]){if(!window.confirm("هزینه «"+item.title+"» حذف شود؟"))return;await deleteCentralRecord("expenses",item.id,()=>removeExpense(item.id));}
  return <div className="space-y-4"><PageHeading title="مدیریت هزینه‌ها" description="ثبت مستقل هزینه‌های جاری، دسته‌بندی و پیگیری مخارج کسب‌وکار."/><div className="grid gap-3 sm:grid-cols-3"><Card><p className="text-xs text-muted">مجموع هزینه‌های نمایش‌داده‌شده</p><p className="text-xl font-bold">{money(total)}</p></Card><Card><p className="text-xs text-muted">تعداد هزینه‌ها</p><p className="text-xl font-bold">{visible.length.toLocaleString("fa-IR")}</p></Card><Card><p className="text-xs text-muted">تعداد دسته‌ها</p><p className="text-xl font-bold">{categories.length.toLocaleString("fa-IR")}</p></Card></div><Card><h3 className="mb-3 font-semibold">ثبت هزینه جدید</h3><form className="grid gap-2 sm:grid-cols-2" onSubmit={e=>void add(e)}><Field label="عنوان هزینه"><input className={inputCls} value={title} onChange={e=>setTitle(e.target.value)} required/></Field><Field label="مبلغ (تومان)"><input className={inputCls} type="number" min="1" value={amount||""} onChange={e=>setAmount(Number(e.target.value))} required/></Field><Field label="تاریخ"><input className={inputCls} type="date" value={date} onChange={e=>setDate(e.target.value)} required/></Field><Field label="دسته‌بندی"><select className={inputCls} value={category} onChange={e=>setCategory(e.target.value)} required>{categories.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></Field><Field label="توضیحات"><input className={inputCls} value={note} onChange={e=>setNote(e.target.value)}/></Field><div className="flex items-end"><Btn type="submit">ثبت هزینه</Btn></div></form></Card><Card><h3 className="mb-2 font-semibold">مدیریت دسته‌بندی‌ها</h3><form className="flex gap-2" onSubmit={e=>void addCat(e)}><input className={inputCls} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="نام دسته جدید"/><Btn type="submit">افزودن</Btn></form><div className="mt-3 space-y-2">{categories.map(item=><div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"><span>{item.name}</span><span className="flex gap-1"><Btn tone="ghost" onClick={()=>void editCategory(item)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void removeCategory(item)}>حذف</Btn></span></div>)}</div></Card><Card><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">سوابق هزینه‌ها</h3><select className={inputCls+" max-w-64"} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">همه دسته‌ها</option>{categories.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></div>{visible.length?visible.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-sm"><div><b>{item.title}</b><p className="text-xs text-muted">{item.category} · {new Date(item.date+"T12:00:00").toLocaleDateString("fa-IR")}{item.note?" · "+item.note:""}</p></div><div className="flex items-center gap-2"><b>{money(item.amount)}</b><Btn tone="ghost" onClick={()=>void edit(item)}>ویرایش</Btn><Btn tone="ghost" onClick={()=>void remove(item)}>حذف</Btn></div></div>):<Empty text="هنوز هزینه‌ای ثبت نشده است."/>}</Card></div>;
}


type ServerOrder = {
  id: string;
  orderNumber: number;
  status: Order["status"];
  items: CartLine[];
  totals: Partial<Pick<Order, "subtotal" | "tierDiscount" | "codeDiscount" | "pointsDiscount" | "tax" | "total">>;
  created_at?: string;
  createdAt?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  payment?: Order["payment"];
  pointsUsed?: number;
  pointsEarned?: number;
  discountCode?: string | null;
};

type ServerBootstrap = Partial<Omit<PosState, "orders" | "settings">> & {
  orders?: ServerOrder[];
  sms_logs?: SmsLog[];
  settings?: Array<Partial<Settings> & { id?: string }>;
};

function readLegacyBrowserPosState(): Partial<PosState> | null {
  try {
    const raw = window.localStorage.getItem("grillcash-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<PosState> } & Partial<PosState>;
    const state = parsed.state ?? parsed;
    const hasBusinessData = ["categories", "products", "ingredients", "customers", "discounts", "orders", "expenses", "templates"]
      .some((key) => Array.isArray(state[key as keyof PosState]) && (state[key as keyof PosState] as unknown[]).length > 0);
    if (!hasBusinessData) return null;
    return {
      ...state,
      settings: state.settings ? {
        ...state.settings,
        smsUser: "",
        smsKey: "",
        smsFrom: "",
      } : undefined,
    };
  } catch {
    return null;
  }
}

function hydratePosFromServer(data: ServerBootstrap, nextOrder: number, role: Role) {
  const current = usePos.getState();
  const serverSettings = data.settings?.[0];
  const orders: Order[] = (data.orders ?? []).map((order) => ({
    id: String(order.id),
    number: Number(order.orderNumber),
    createdAt: order.createdAt ?? order.created_at ?? new Date().toISOString(),
    status: order.status,
    lines: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.totals?.subtotal ?? 0),
    tierDiscount: Number(order.totals?.tierDiscount ?? 0),
    codeDiscount: Number(order.totals?.codeDiscount ?? 0),
    pointsDiscount: Number(order.totals?.pointsDiscount ?? 0),
    tax: Number(order.totals?.tax ?? 0),
    total: Number(order.totals?.total ?? 0),
    payment: order.payment ?? "cash",
    customerId: order.customerId ?? null,
    customerName: order.customerName ?? "",
    customerPhone: order.customerPhone ?? "",
    discountCode: order.discountCode ?? "",
    pointsUsed: Number(order.pointsUsed ?? 0),
    pointsEarned: Number(order.pointsEarned ?? 0),
  }));

  // Bootstrap is a complete snapshot for the authenticated role. Missing
  // collections are intentionally cleared (e.g. kitchen must not retain
  // manager-only records from a previous in-memory session).
  usePos.setState({
    categories: data.categories ?? [],
    products: data.products ?? [],
    ingredients: data.ingredients ?? [],
    customers: data.customers ?? [],
    discounts: data.discounts ?? [],
    expenses: data.expenses ?? [],
    templates: data.templates ?? [],
    smsLogs: data.sms_logs ?? [],
    orders,
    settings: {
      ...current.settings,
      ...(serverSettings ?? {}),
      smsUser: "",
      smsKey: "",
      smsFrom: "",
      role,
    },
    nextOrder: Math.max(nextOrder, 1),
  });
  return true;
}


function SettingsScreen() {
  const settings = usePos((s) => s.settings);
  const patchSettings = usePos((s) => s.patchSettings);
  const [note, setNote] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  function persistSettings() {
    const current = usePos.getState().settings;
    void saveCentralRecord("settings", { id: "main", ...current, smsUser: "", smsKey: "", smsFrom: "" }, () => {});
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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.taxEnabled !== false} onChange={(e) => { const value = e.target.checked; patchSettings({ taxEnabled: value }); const current = usePos.getState().settings; void saveCentralRecord("settings", { id: "main", ...current, taxEnabled: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />محاسبه مالیات فعال باشد</label>
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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.autoPrint} onChange={(e) => { const value = e.target.checked; patchSettings({ autoPrint: value }); const current = usePos.getState().settings; void saveCentralRecord("settings", { id: "main", ...current, autoPrint: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />چاپ خودکار</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.printCustomer} onChange={(e) => { const value = e.target.checked; patchSettings({ printCustomer: value }); const current = usePos.getState().settings; void saveCentralRecord("settings", { id: "main", ...current, printCustomer: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />فیش مشتری</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.printKitchen} onChange={(e) => { const value = e.target.checked; patchSettings({ printKitchen: value }); const current = usePos.getState().settings; void saveCentralRecord("settings", { id: "main", ...current, printKitchen: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />فیش آشپزخانه</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.invoiceSmsEnabledDefault ?? false} onChange={(e) => { const value=e.target.checked; patchSettings({invoiceSmsEnabledDefault:value}); const current=usePos.getState().settings; void saveCentralRecord("settings",{id:"main",...current,invoiceSmsEnabledDefault:value,smsUser:"",smsKey:"",smsFrom:""},()=>{}); }}/>ارسال پیامک ریز فاکتور به‌صورت پیش‌فرض فعال باشد</label>
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
