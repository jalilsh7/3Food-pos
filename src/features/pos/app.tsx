import { useEffect, useRef, useState } from "react";
import {
  ChefHat, ClipboardList, LayoutDashboard, MessageSquare, Percent,
  Settings as SettingsIcon, ShoppingBag, Users, UtensilsCrossed, Warehouse, Truck, LogOut,
} from "lucide-react";
import { Btn, Card, Empty, Field, PageHeading, inputCls } from "./bits";
import { ReceiptView } from "./receipt";
import {
  customerCodeUses, fillTemplate, money, quoteOrder, TIER_LABEL, tierOf, uid,
  type CartLine, type Order, type Product, type Role, type SmsEvent, type SmsLog,
} from "@/lib/pos/model";
import { lowStock, usePos } from "@/lib/pos/store";
import { phpApi, type ApiUser, type PaymentTerminal } from "@/lib/api/php-client";
import { useAppearance } from "@/lib/appearance";

import { normalizeIranPhone, tehranDate, formatElapsed } from "@/lib/pos/formatters";
import { ROLE_LABEL, UsersScreen } from "./users-screen";
import { AuthFrame, PhpLoginScreen, ChangePasswordScreen } from "./auth-screens";
import { SmsScreen } from "./sms-screen";
import { SuppliersScreen } from "./suppliers-screen";
import { ExpensesScreen } from "./expenses-screen";
import { CodesScreen } from "./codes-screen";
import { CustomersScreen } from "./customers-screen";
import { ReportsScreen } from "./reports-screen";
import { SettingsScreen } from "./settings-screen";
import { hydratePosFromServer, type ExpenseCategory, type ServerBootstrap } from "./pos-data";

const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "expense-cat-utilities", name: "قبوض آب، برق و گاز", active: true },
  { id: "expense-cat-ingredients", name: "مواد اولیه", active: true },
  { id: "expense-cat-payroll", name: "حقوق و دستمزد", active: true },
  { id: "expense-cat-rent", name: "اجاره", active: true },
  { id: "expense-cat-maintenance", name: "تعمیرات و نگهداری", active: true },
  { id: "expense-cat-packaging", name: "بسته‌بندی", active: true },
  { id: "expense-cat-transport", name: "حمل‌ونقل", active: true },
  { id: "expense-cat-other", name: "سایر هزینه‌ها", active: true },
];

async function loadExpenseCategories() {
  const result = await phpApi.listRecords<ExpenseCategory>("expense_categories");
  if (result.items.length > 0) return result.items;
  await Promise.all(DEFAULT_EXPENSE_CATEGORIES.map((item) => phpApi.saveRecord("expense_categories", item)));
  return DEFAULT_EXPENSE_CATEGORIES;
}

async function saveCentralRecord<T extends { id: string | number }>(resource: string, item: T, commit: () => void) {
  try {
    await phpApi.saveRecord(resource, item);
    commit();
    return true;
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "ذخیره در سرور انجام نشد");
    return false;
  }
}
async function adjustCentralStock<TItem extends { id: string }>(id: string, delta: number, commit: (item: TItem) => void) {
  try {
    const result = await phpApi.adjustIngredientStock<TItem>(id, delta);
    commit(result.item);
    return true;
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "تغییر موجودی در سرور انجام نشد");
    return false;
  }
}
async function deleteCentralRecord(resource: string, id: string, commit: () => void) {
  try {
    await phpApi.deleteRecord(resource, id);
    commit();
    return true;
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "حذف از سرور انجام نشد");
    return false;
  }
}

const INITIAL_RENDER_TIME = Date.now();

type View = "pos" | "orders" | "menu" | "stock" | "customers" | "codes" | "reports" | "expenses" | "suppliers" | "sms" | "users" | "settings";

const NAV: { id: View; label: string; icon: typeof ShoppingBag; roles: Role[] }[] = [
  { id: "pos", label: "فروش", icon: ShoppingBag, roles: ["manager", "cashier"] },
  { id: "orders", label: "سفارش‌ها", icon: ClipboardList, roles: ["manager", "cashier", "kitchen"] },
  { id: "menu", label: "منو", icon: UtensilsCrossed, roles: ["manager"] },
  { id: "stock", label: "انبار", icon: Warehouse, roles: ["manager"] },
  { id: "customers", label: "باشگاه", icon: Users, roles: ["manager", "cashier"] },
  { id: "codes", label: "کد تخفیف", icon: Percent, roles: ["manager"] },
  { id: "reports", label: "گزارش", icon: LayoutDashboard, roles: ["manager"] },
  { id: "expenses", label: "هزینه‌ها", icon: ClipboardList, roles: ["manager"] },
  { id: "suppliers", label: "تأمین‌کنندگان", icon: Truck, roles: ["manager"] },
  { id: "sms", label: "پیامک", icon: MessageSquare, roles: ["manager"] },
  { id: "users", label: "کاربران", icon: Users, roles: ["manager"] },
  { id: "settings", label: "تنظیمات", icon: SettingsIcon, roles: ["manager"] },
];

const EVENT_LABEL: Record<SmsEvent, string> = {
  order_created: "ثبت سفارش", order_ready: "آماده شدن", order_delivered: "تحویل",
  points_earned: "کسب امتیاز", discount_used: "استفاده از کد",
};

export function GrillApp() {
  const shop = usePos((s) => s.settings.shopName);
  const { settings: appearance } = useAppearance();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let active = true;
    void phpApi.me()
      .then(async (result) => {
        if (!active) return;
        if (result.authenticated && result.user) {
          setUser(result.user);
          return;
        }
        const setup = await phpApi.setupStatus();
        if (active) setSetupRequired(setup.setup_required);
      })
      .catch((error: unknown) => {
        if (active) setSessionError(error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || user.must_change_password) return;
    let active = true;
    let inFlight = false;
    const refresh = async (showError = false) => {
      if (!active || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const result = await phpApi.bootstrap<ServerBootstrap>();
        if (active) hydratePosFromServer(result.data, result.next_order, user.role);
      } catch (error) {
        // A temporary network failure must not log the user out or replace
        // the last known good state. The next poll/focus event retries.
        if (active && showError) {
          setSessionError(error instanceof Error ? error.message : "دریافت داده‌های MySQL انجام نشد");
        }
      } finally {
        inFlight = false;
      }
    };
    void refresh(true);
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  async function logout() {
    try {
      await phpApi.logout();
      setUser(null);
      setSessionError("");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "خروج انجام نشد");
    }
  }

  if (loading) return <AuthFrame><p className="text-sm text-muted">در حال بررسی نشست امن...</p></AuthFrame>;
  if (sessionError && !user) return <AuthFrame><p className="text-sm text-warn">{sessionError}</p><button className="rounded-xl bg-ink px-4 py-2 text-bg" onClick={() => window.location.reload()}>تلاش دوباره</button></AuthFrame>;
  if (!user) return <PhpLoginScreen setupRequired={setupRequired} onAuthenticated={setUser} />;
  if (user.must_change_password) return <ChangePasswordScreen user={user} onChanged={() => setUser({ ...user, must_change_password: false })} />;
  const allowed = NAV.filter((n) => n.roles.includes(user.role));
  const [viewFallback] = allowed;
  return (
    <div className="pos-app min-h-screen bg-bg text-ink">
      <header className="pos-topbar sticky top-0 z-30 flex min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {appearance.logoUrl ? (
            <img src={appearance.logoUrl} alt="لوگوی فروشگاه" className="h-11 w-11 rounded-2xl border border-line bg-surface object-contain p-1" />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-chili text-chili-ink shadow-sm"><UtensilsCrossed size={21} /></div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold tracking-tight sm:text-lg">{shop}</p>
            <p className="text-[11px] font-medium text-muted sm:text-xs">سامانه مدیریت و فروش 3Food</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden text-left sm:block">
            <p className="text-sm font-bold">{user.display_name}</p>
            <p className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf/10 text-sm font-bold text-leaf">{user.display_name.trim().slice(0, 1) || "ک"}</span>
          <button type="button" onClick={() => void logout()} className="pos-logout inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold sm:text-sm">
            <LogOut size={16} /><span className="hidden sm:inline">خروج امن</span>
          </button>
        </div>
      </header>
      <PosWorkspace allowed={allowed} initialView={viewFallback?.id ?? "orders"} role={user.role} />
    </div>
  );
}

function PosWorkspace({ allowed, initialView, role }: { allowed: typeof NAV; initialView: View; role: Role }) {
  const [view, setView] = useState<View>(initialView);
  const [showAllNav, setShowAllNav] = useState(false);
  const current = allowed.some((n) => n.id === view) ? view : allowed[0]?.id ?? "orders";
  const visibleNav = showAllNav ? allowed : allowed.slice(0, 5);
  return (
    <div className="pos-layout mx-auto grid w-full max-w-[1600px] min-w-0 gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-6 lg:px-7 lg:py-7">
      <nav className="pos-nav min-w-0 lg:sticky lg:top-[92px] lg:flex lg:h-[calc(100vh-116px)] lg:flex-col">
        <div className="hidden px-3 pb-4 pt-2 lg:block">
          <p className="text-[10px] font-bold tracking-[0.18em] text-muted">WORKSPACE</p>
          <p className="mt-1 text-sm font-extrabold">دسترسی سریع</p>
        </div>
        <div className="pos-nav-list flex min-w-0 gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            const on = current === n.id;
            return (
              <button key={n.id} type="button" aria-current={on ? "page" : undefined} onClick={() => setView(n.id)} className={`pos-nav-item inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${on ? "is-active" : ""}`}>
                <span className="grid h-8 w-8 place-items-center rounded-xl"><Icon size={18} strokeWidth={2} /></span>
                <span>{n.label}</span>
              </button>
            );
          })}
          {allowed.length > 5 ? (
            <button
              type="button"
              aria-expanded={showAllNav}
              onClick={() => setShowAllNav((expanded) => !expanded)}
              className="pos-nav-item inline-flex shrink-0 items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold"
            >
              {showAllNav ? "نمایش کمتر" : "نمایش بیشتر"}
            </button>
          ) : null}
        </div>
        <div className="mt-auto hidden rounded-2xl border border-line bg-surface/80 p-4 lg:block">
          <p className="text-xs font-bold text-ink">3Food POS</p>
          <p className="mt-1 text-[11px] leading-6 text-muted">مدیریت یکپارچه فروش، سفارش و موجودی</p>
          <span className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold text-leaf"><span className="h-1.5 w-1.5 rounded-full bg-leaf" /> سامانه فعال</span>
        </div>
      </nav>
      <main className="pos-main min-w-0">
        {current === "pos" ? <PosScreen role={role} /> : null}
        {current === "orders" ? <OrdersScreen role={role} /> : null}
        {current === "menu" ? <MenuScreen /> : null}
        {current === "stock" ? <StockScreen /> : null}
        {current === "customers" ? <CustomersScreen role={role} saveRecord={saveCentralRecord} /> : null}
        {current === "codes" ? <CodesScreen saveRecord={saveCentralRecord} deleteRecord={deleteCentralRecord} /> : null}
        {current === "reports" ? <ReportsScreen loadCategories={loadExpenseCategories} saveRecord={saveCentralRecord} deleteRecord={deleteCentralRecord} /> : null}
        {current === "expenses" ? <ExpensesScreen loadCategories={loadExpenseCategories} saveRecord={saveCentralRecord} deleteRecord={deleteCentralRecord} /> : null}
        {current === "suppliers" ? <SuppliersScreen saveCentralRecord={saveCentralRecord} onPurchaseSaved={async () => { const snapshot = await phpApi.bootstrap<ServerBootstrap>(); hydratePosFromServer(snapshot.data, snapshot.next_order, "manager"); }} /> : null}
        {current === "sms" ? <SmsScreen sendRaw={sendRaw} saveCentralRecord={saveCentralRecord} /> : null}
        {current === "users" ? <UsersScreen /> : null}
        {current === "settings" ? <SettingsScreen saveRecord={saveCentralRecord} /> : null}
      </main>
    </div>
  );
}

function orderVars(order: Order, balance = "") {
  return { name: order.customerName || "مشتری", order: String(order.number), total: money(order.total), points: String(order.pointsEarned), code: order.discountCode, balance, shop: usePos.getState().settings.shopName };
}

async function pushSms(event: SmsEvent, phone: string, vars: Record<string, string>) {
  const s = usePos.getState();
  const tpl = s.templates.find((t) => t.event === event);
  if (!tpl?.enabled || !phone) return;
  const text = fillTemplate(tpl.body, { ...vars, shop: s.settings.shopName });
  await postSms(phone, text, event, tpl.bodyId);
}

async function sendRaw(phone: string, text: string) {
  const normalized=normalizeIranPhone(phone);
  if (!/^09[0-9]{9}$/.test(normalized) || !text) return false;
  return await postSms(normalized, text, "manual", "");
}

async function postSms(phone: string, text: string, event: string, bodyId: string) {
  let log: SmsLog = {
    id: uid("sm"),
    at: new Date().toISOString(),
    to: phone,
    event,
    text,
    ok: false,
    detail: "ارسال انجام نشد",
  };
  try {
    const data = await phpApi.sendSms({ to: phone, text, bodyId });
    log = { ...log, ok: data.sent, detail: data.detail };
  } catch (err) {
    log = { ...log, detail: err instanceof Error ? err.message : "خطا در ارسال پیامک" };
  }
  try {
    await phpApi.saveRecord("sms_logs", log);
  } catch (err) {
    log = { ...log, detail: `${log.detail} — ذخیره گزارش در سرور ناموفق بود: ${err instanceof Error ? err.message : "خطای نامشخص"}` };
  }
  usePos.getState().logSms(log);
  return log.ok;
}

function PosScreen({ role }: { role: Role }) {
  const categories = usePos((s) => s.categories);
  const products = usePos((s) => s.products);
  const ingredients = usePos((s) => s.ingredients);
  const customers = usePos((s) => s.customers);
  const orders = usePos((s) => s.orders);
  const discounts = usePos((s) => s.discounts);
  const settings = usePos((s) => s.settings);
  const placeOrder = usePos((s) => s.placeOrder);
  const [cat, setCat] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("مشتری عزیز");
  const [code, setCode] = useState("");
  const [points, setPoints] = useState(0);
  const [pay, setPay] = useState<Order["payment"]>("cash");
  const [terminalOptions,setTerminalOptions]=useState<PaymentTerminal[]>([]);
  const [selectedTerminalId,setSelectedTerminalId]=useState("");
  const pendingTerminalPayment=useRef<{id:string;amount:number;terminalId:string}|null>(null);
  // Retain the request key before network I/O so a lost response can be replayed safely.
  const pendingTerminalRequest=useRef<{key:string;amount:number;terminalId:string}|null>(null);
  const [sendInvoiceSms, setSendInvoiceSms] = useState<boolean | null>(null);
  const shouldSendInvoiceSms = sendInvoiceSms ?? settings.invoiceSmsEnabledDefault ?? false;
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pendingIdempotencyKey = useRef<string | null>(null);
  const [printed, setPrinted] = useState<Order | null>(null);
  const [optFor, setOptFor] = useState<Product | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [stockWarningMutedUntil, setStockWarningMutedUntil] = useState(0);
  const [stockClock, setStockClock] = useState(INITIAL_RENDER_TIME);
  useEffect(()=>{let active=true;void phpApi.listAvailableTerminals().then(result=>{if(!active)return;setTerminalOptions(result.items);const preferred=result.items.find(t=>t.is_default||t.isDefault)??result.items[0];if(preferred)setSelectedTerminalId(preferred.id);}).catch(()=>{if(active)setTerminalOptions([]);});return()=>{active=false;};},[]);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setStockWarningMutedUntil(Number(window.localStorage.getItem("3food-pos-stock-warning-muted-until") || 0));
      } catch {
        setStockWarningMutedUntil(0);
      }
      setStockClock(Date.now());
    });
    const timer = window.setInterval(() => setStockClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const requiredIngredients = new Map<string, number>();
  for (const line of cart) {
    const product = products.find((item) => item.id === line.productId);
    for (const recipeLine of product?.recipe ?? []) {
      requiredIngredients.set(recipeLine.ingredientId, (requiredIngredients.get(recipeLine.ingredientId) ?? 0) + recipeLine.qty * line.qty);
    }
    for (const optionId of line.optionIds) {
      const option = product?.options.find((item) => item.id === optionId);
      if (option?.ingredientId && option.ingredientQty && option.ingredientQty > 0) {
        requiredIngredients.set(option.ingredientId, (requiredIngredients.get(option.ingredientId) ?? 0) + option.ingredientQty * line.qty);
      }
    }
  }
  const stockShortages = [...requiredIngredients.entries()].flatMap(([ingredientId, required]) => {
    const ingredient = ingredients.find((item) => item.id === ingredientId);
    return ingredient && ingredient.stock < required ? [{ name: ingredient.name, stock: ingredient.stock, required, unit: ingredient.unit }] : [];
  });
  const stockPolicy = settings.stockPolicy ?? "warn_and_allow";
  const showStockWarning = stockShortages.length > 0 && stockPolicy !== "allow_negative" &&
    (stockPolicy === "block" || stockClock >= stockWarningMutedUntil);
  function muteStockWarningForHour() {
    const until = Date.now() + 60 * 60 * 1000;
    setStockWarningMutedUntil(until);
    setStockClock(Date.now());
    try {
      window.localStorage.setItem("3food-pos-stock-warning-muted-until", String(until));
    } catch {
      // The alert remains dismissible for this session if storage is unavailable.
    }
  }
  const customer = customers.find((c) => normalizeIranPhone(c.phone) === normalizeIranPhone(phone)) ?? null;
  function updateCustomerPhone(value: string) {
    setPhone(value);
    const matched = customers.find((item) => normalizeIranPhone(item.phone) === normalizeIranPhone(value));
    setGuestName(matched?.name || "مشتری عزیز");
  }
  const uses = customer && code ? customerCodeUses(orders, customer.id, code) : 0;
  const q = quoteOrder({ lines: cart, customer, code, discounts, pointsToUse: points, taxPercent: settings.taxPercent, taxEnabled: settings.taxEnabled, tomanPerPoint: settings.tomanPerPoint, usesSoFar: uses, settings });

  function addProduct(p: Product, optionIds: string[], noteText: string) {
    const opts = p.options.filter((o) => optionIds.includes(o.id));
    const unit = p.price + opts.reduce((s, o) => s + o.price, 0);
    const key = `${p.id}:${[...optionIds].sort().join(",")}:${noteText}`;
    setCart((prev) => {
      const hit = prev.find((l) => l.key === key);
      if (hit) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key, productId: p.id, name: p.name, qty: 1, unitPrice: unit, optionIds, optionLabels: opts.map((o) => o.name), note: noteText }];
    });
  }


  async function waitForTerminalApproval(amount:number):Promise<string> {
    if(pendingTerminalPayment.current&&pendingTerminalPayment.current.amount!==amount)
      throw new Error("یک پرداخت کارتخوان تأییدشده برای مبلغ قبلی در انتظار ثبت سفارش است؛ مبلغ سبد را تغییر ندهید و ابتدا سفارش را تعیین‌تکلیف کنید.");
    let pending=pendingTerminalPayment.current;
    if(!pending){
      const unresolved=(await phpApi.listPendingTerminalPayments()).items;
      if(unresolved.length>1)throw new Error("چند تراکنش تعیین‌تکلیف‌نشده وجود دارد؛ مدیر باید ابتدا وضعیت آن‌ها را بررسی کند.");
      if(unresolved.length===1){
        const previous=unresolved[0];
        if(previous.amount!==amount)throw new Error("یک تراکنش قبلی با مبلغ متفاوت در انتظار تعیین‌تکلیف است؛ پرداخت جدید مجاز نیست.");
        if(previous.status==="unknown")throw new Error("نتیجه تراکنش قبلی نامشخص است؛ قبل از پرداخت مجدد، از بانک استعلام کنید.");
        pending={id:previous.id,amount,terminalId:previous.terminal_id??""};
        pendingTerminalPayment.current=pending;
      }else{
        const available=terminalOptions.length?terminalOptions:(await phpApi.listAvailableTerminals()).items;
        setTerminalOptions(available);
        const terminal=available.find(t=>t.id===selectedTerminalId)??available.find(t=>t.is_default||t.isDefault)??available[0];
        if(!terminal)throw new Error("کارتخوان آنلاین و دارای درایور تأییدشده پیدا نشد؛ تنظیمات کارتخوان را بررسی کنید.");
        let request=pendingTerminalRequest.current;
        if(request&&request.amount!==amount)throw new Error("یک درخواست پرداخت قبلی با مبلغ متفاوت تعیین‌تکلیف نشده است؛ ابتدا همان تراکنش را بررسی کنید.");
        if(request&&request.terminalId!==terminal.id)throw new Error("درخواست پرداخت قبلی به کارتخوان دیگری تعلق دارد؛ ابتدا همان تراکنش را تعیین‌تکلیف کنید.");
        if(!request){request={key:crypto.randomUUID(),amount,terminalId:terminal.id};pendingTerminalRequest.current=request;}
        const created=await phpApi.createTerminalPayment({terminalId:request.terminalId,amount,idempotencyKey:request.key});
        pending={id:created.payment.id,amount,terminalId:request.terminalId};pendingTerminalPayment.current=pending;
      }
    }
    for(let attempt=0;attempt<60;attempt++){
      const result=await phpApi.getTerminalPayment(pending.id);
      const status=result.payment.status;
      if(status==="approved")return pending.id;
      if(status==="declined"){
        pendingTerminalPayment.current=null;
        pendingTerminalRequest.current=null;
        throw new Error("بانک تراکنش را رد کرد. مبلغی به‌عنوان پرداخت موفق ثبت نشد؛ اکنون می‌توانید پرداخت جدیدی انجام دهید.");
      }
      if(status==="cancelled"){
        pendingTerminalPayment.current=null;
        pendingTerminalRequest.current=null;
        throw new Error("تراکنش کارتخوان لغو شد؛ اکنون می‌توانید پرداخت جدیدی انجام دهید.");
      }
      if(status==="unknown"||status==="expired")throw new Error("نتیجه تراکنش قطعی نیست. قبل از تلاش مجدد، وضعیت را از کارتخوان یا بانک استعلام کنید.");
      await new Promise<void>(resolve=>window.setTimeout(resolve,1500));
    }
    throw new Error("پاسخ کارتخوان در زمان مقرر نرسید. وضعیت تراکنش را بررسی کنید و پرداخت جدیدی ایجاد نکنید.");
  }

  async function checkout() {
    if (submitting || !cart.length) return;
    if (code.trim() && q.codeError) { setMsg(q.codeError); return; }
    if (q.pointsError) { setMsg(q.pointsError); return; }
    setSubmitting(true);
    setMsg("");
    try {
      if(pendingTerminalPayment.current&&pay!=="card")throw new Error("یک پرداخت کارتخوان تعیین‌تکلیف‌نشده وجود دارد؛ ابتدا همان سفارش را تکمیل کنید.");
      // Every identified buyer joins the shared customer club before the order is created.
      // The phone is the stable lookup key; the server then updates points and purchase totals.
      let checkoutCustomer = customer;
      if (checkoutCustomer && guestName.trim() && guestName.trim() !== checkoutCustomer.name) {
        const renamedCustomer = { ...checkoutCustomer, name: guestName.trim() };
        const savedCustomer = await phpApi.saveRecord("customers", renamedCustomer);
        checkoutCustomer = savedCustomer.item ?? renamedCustomer;
        usePos.getState().saveCustomer(checkoutCustomer);
      }
      if (!checkoutCustomer) {
        const normalizedPhone = normalizeIranPhone(phone);
        if (!/^09[0-9]{9}$/.test(normalizedPhone)) throw new Error("برای ثبت سفارش، شماره موبایل معتبر ایران را وارد کنید.");
        const existing = usePos.getState().customers.find((item) => normalizeIranPhone(item.phone) === normalizedPhone);
        if (existing) {
          checkoutCustomer = existing;
        } else {
          const createdCustomer = {
            id: uid("cu"),
            name: guestName.trim() || "مشتری عزیز",
            phone: normalizedPhone,
            points: 0,
            birthday: "",
            totalSpent: 0,
            visits: 0,
            createdAt: new Date().toISOString(),
          };
          const savedCustomer = await phpApi.saveRecord("customers", createdCustomer);
          usePos.getState().saveCustomer(savedCustomer.item ?? createdCustomer);
          checkoutCustomer = createdCustomer;
        }
      }
      const terminalPaymentId = pay==="card" ? await waitForTerminalApproval(q.total) : null;
      const idempotencyKey = pendingIdempotencyKey.current ?? crypto.randomUUID();
      pendingIdempotencyKey.current = idempotencyKey;
      const server = await phpApi.createOrder<{ id: string; orderNumber: number; createdAt: string }>({
        idempotencyKey,
        items: cart.map((line) => ({
          key: line.key,
          name: line.name,
          productId: line.productId,
          qty: line.qty,
          unitPrice: line.unitPrice,
          optionIds: line.optionIds,
          optionLabels: line.optionLabels,
          note: line.note,
        })),
        totals: {
          subtotal: q.subtotal,
          tierDiscount: q.tierDiscount,
          codeDiscount: q.codeDiscount,
          pointsDiscount: q.pointsDiscount,
          tax: q.tax,
          total: q.total,
        },
        customer: checkoutCustomer ? { id: checkoutCustomer.id } : undefined,
        discountCode: q.discount?.code ?? '',
        note: cart.map((line) => line.note).filter(Boolean).join(" | ").slice(0, 2000),
        guestName,
        guestPhone: normalizeIranPhone(phone),
        payment: pay,
        ...(terminalPaymentId ? { terminalPaymentId } : {}),
      });
      const localResult = placeOrder({
        lines: cart,
        customer: checkoutCustomer,
        code,
        pointsToUse: points,
        taxEnabled: settings.taxEnabled !== false,
        payment: pay,
        guestName,
        guestPhone: phone.trim(),
        serverOrder: { id: server.order.id, number: server.order.orderNumber, createdAt: server.order.createdAt },
      });
      let order: Order | null = localResult.ok ? localResult.order : null;
      try {
        // The MySQL snapshot is authoritative for stock, loyalty, coupons and
        // the canonical order. Refresh immediately after the committed write.
        const snapshot = await phpApi.bootstrap<ServerBootstrap>();
        hydratePosFromServer(snapshot.data, snapshot.next_order, role);
        order = usePos.getState().orders.find((item) => item.id === server.order.id) ?? order;
      } catch {
        // Keep the local fallback; the periodic bootstrap retries the snapshot.
      }
      if (!order) {
        setMsg(`سفارش در سرور ثبت شد، اما همگام‌سازی محلی انجام نشد: ${localResult.ok ? "سفارش در snapshot پیدا نشد" : localResult.error}. صفحه را تازه‌سازی کنید.`);
        return;
      }
      pendingIdempotencyKey.current = null;
      pendingTerminalPayment.current = null;
      pendingTerminalRequest.current = null;
      setMsg(`سفارش ${order.number.toLocaleString("fa-IR")} ثبت شد`);
      setCart([]); setPhone(""); setGuestName("مشتری عزیز"); setCode(""); setPoints(0); setSendInvoiceSms(null); setPrinted(order);
      const fresh = usePos.getState().customers.find((c) => c.id === order.customerId);
      const vars = orderVars(order, String(fresh?.points ?? 0));
      void pushSms("order_created", order.customerPhone, vars);
      if (shouldSendInvoiceSms && order.customerPhone) {
        const invoice = [`${settings.shopName} - فاکتور سفارش ${order.number}`, ...order.lines.map(line => `${line.name} × ${line.qty}: ${money(line.unitPrice * line.qty)}`), `جمع: ${money(order.subtotal)}`, `تخفیف: ${money(order.tierDiscount + order.codeDiscount + order.pointsDiscount)}`, `مالیات: ${money(order.tax)}`, `مبلغ نهایی: ${money(order.total)}`, `تاریخ: ${new Date(order.createdAt).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"})}`].join("\n").slice(0, 950);
        void postSms(order.customerPhone, invoice, "order_invoice", "");
      }
      if (order.pointsEarned) void pushSms("points_earned", order.customerPhone, vars);
      if (order.discountCode) void pushSms("discount_used", order.customerPhone, vars);
      if (settings.autoPrint) setTimeout(() => window.print(), 300);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "ثبت سفارش در سرور انجام نشد");
    } finally {
      setSubmitting(false);
    }
  }

  const shown = products.filter((p) =>
    p.active &&
    (!cat || p.categoryId === cat) &&
    (!productQuery.trim() || p.name.toLocaleLowerCase("fa").includes(productQuery.trim().toLocaleLowerCase("fa")))
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="lg:col-span-2"><PageHeading title="صندوق فروش" description="محصول را انتخاب کنید، سفارش را بسازید و پرداخت را ثبت کنید." /></div>
      <div>
        <div className="mb-3 space-y-2">
          <input className={inputCls} value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="جستجوی نام محصول..." />
          <div className="flex min-w-0 flex-wrap gap-2">
            <button onClick={() => setCat("")} className={`rounded-full px-4 py-2 text-sm ${cat === "" ? "bg-ink text-bg" : "bg-surface border border-line"}`}>همه دسته‌ها</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full px-4 py-2 text-sm ${cat === c.id ? "bg-ink text-bg" : "bg-surface border border-line"}`}>{c.name}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => (
            <button key={p.id} onClick={() => { if (p.options.length) { setOptFor(p); setPicked([]); setNote(""); } else addProduct(p, [], ""); }} className="rounded-2xl border border-line bg-surface p-3 text-right shadow-sm">
              <p className="font-semibold">{p.name}</p>
              <p className="mt-2 text-sm text-chili">{money(p.price)}</p>
            </button>
          ))}
        </div>
      </div>
      <Card>
        <h2 className="mb-3 font-bold">سفارش جاری</h2>
        {showStockWarning ? (
          <div role="status" className="mb-3 rounded-xl border border-warn bg-warn-bg p-3 text-sm text-warn">
            <p className="font-bold">هشدار کمبود موجودی</p>
            <p className="mt-1">{stockShortages.map((item) => `${item.name}: موجودی ${item.stock.toLocaleString("fa-IR")}، نیاز سفارش ${item.required.toLocaleString("fa-IR")} ${item.unit}`).join(" · ")}</p>
            <p className="mt-1">{stockPolicy === "block" ? "ثبت سفارش تا تأمین موجودی متوقف می‌شود." : "ثبت سفارش ادامه پیدا می‌کند و کسری موجودی در انبار ثبت خواهد شد."}</p>
            {stockPolicy === "warn_and_allow" ? <Btn tone="ghost" onClick={muteStockWarningForHour}>خاموش‌کردن هشدار برای یک ساعت</Btn> : null}
          </div>
        ) : null}
        {cart.length === 0 ? <Empty text="آیتمی انتخاب نشده" /> : null}
        <ul className="space-y-2">
          {cart.map((l) => (
            <li key={l.key} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-semibold">{l.name}</p>
                <p className="text-xs text-muted">{l.optionLabels.join("، ")}</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-lg border border-line px-3 py-2" onClick={() => setCart((c) => c.flatMap((x) => (x.key === l.key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))}>−</button>
                <span>{l.qty.toLocaleString("fa-IR")}</span>
                <button className="rounded-lg border border-line px-3 py-2" onClick={() => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)))}>+</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2">
          <Field label="نام مشتری"><input className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="مشتری عزیز" /></Field>
          <Field label="موبایل مشتری"><input className={inputCls} value={phone} onChange={(e) => updateCustomerPhone(e.target.value)} placeholder="0912..." /></Field>
          {customer ? (
            <p className="rounded-xl bg-leaf-ink px-3 py-2 text-sm text-leaf">{TIER_LABEL[tierOf(customer.points,settings)]} ({customer.points.toLocaleString("fa-IR")} امتیاز، تخفیف {(tierOf(customer.points,settings)==="silver"?settings.loyaltySilverDiscount??3:tierOf(customer.points,settings)==="gold"?settings.loyaltyGoldDiscount??5:tierOf(customer.points,settings)==="platinum"?settings.loyaltyPlatinumDiscount??8:0).toLocaleString("fa-IR")}٪)</p>
          ) : null}
          <Field label="کد تخفیف"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME" /></Field>
          {q.codeError ? <p className="text-sm text-warn">{q.codeError}</p> : null}
          {customer ? <Field label="استفاده از امتیاز"><input className={inputCls} type="number" min={0} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></Field> : null}
          {q.pointsError ? <p className="text-sm text-warn">{q.pointsError}</p> : null}
          <div className="flex gap-2">
            {(["cash", "card"] as const).map((p) => (
              <button key={p} onClick={() => setPay(p)} className={`flex-1 rounded-xl py-3 text-sm ${pay === p ? "bg-ink text-bg" : "border border-line"}`}>{p === "cash" ? "نقد" : "کارتخوان"}</button>
            ))}
            <button type="button" disabled title="پس از اتصال درگاه بانکی فعال می‌شود" className="flex-1 cursor-not-allowed rounded-xl border border-line py-3 text-sm opacity-50">آنلاین (به‌زودی)</button>
            {pay==="card"?<div className="mt-2 w-full"><Field label="کارتخوان"><select className={inputCls} value={selectedTerminalId} onChange={e=>setSelectedTerminalId(e.target.value)}><option value="">انتخاب کارتخوان آنلاین</option>{terminalOptions.map(t=><option key={t.id} value={t.id}>{t.name} · {t.provider_code??"شرکت نامشخص"}</option>)}</select></Field><p className="mt-1 text-xs text-muted">مبلغ نهایی سفارش ({money(q.total)}) پس از تأیید به کارتخوان ارسال می‌شود.</p></div>:null}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shouldSendInvoiceSms} onChange={e=>setSendInvoiceSms(e.target.checked)}/>ارسال پیامک ریز فاکتور برای مشتری</label>
          <p className="flex justify-between text-sm"><span>جمع</span><span>{money(q.subtotal)}</span></p>
          {q.tierDiscount ? <p className="flex justify-between text-sm"><span>سطح عضویت</span><span>{money(q.tierDiscount)}</span></p> : null}
          {q.codeDiscount ? <p className="flex justify-between text-sm"><span>کد</span><span>{money(q.codeDiscount)}</span></p> : null}
          <p className="flex justify-between text-base font-bold"><span>قابل پرداخت</span><span>{money(q.total)}</span></p>
          {msg ? <p className="text-sm text-leaf">{msg}</p> : null}
          <Btn onClick={checkout} disabled={!cart.length || submitting}>{submitting ? "در حال ثبت در سرور..." : "ثبت سفارش"}</Btn>
        </div>
      </Card>
      {optFor ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <Card className="w-full max-w-md">
            <h3 className="mb-2 font-bold">{optFor.name}</h3>
            {optFor.options.map((o) => (
              <label key={o.id} className="mt-2 flex items-center justify-between text-sm">
                <span><input type="checkbox" className="ms-2" checked={picked.includes(o.id)} onChange={() => setPicked((ids) => ids.includes(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id])} />{o.name}</span>
                <span>{o.price ? money(o.price) : "رایگان"}</span>
              </label>
            ))}
            <Field label="یادداشت آشپزخانه"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="mt-3 flex gap-2">
              <Btn onClick={() => { addProduct(optFor, picked, note); setOptFor(null); }}>افزودن</Btn>
              <Btn tone="ghost" onClick={() => setOptFor(null)}>انصراف</Btn>
            </div>
          </Card>
        </div>
      ) : null}
      {printed ? (
        <>
          <div id="print-root" className="hidden print:block">
            {settings.printCustomer ? <ReceiptView order={printed} settings={settings} kind="customer" /> : null}
            {settings.printKitchen ? <ReceiptView order={printed} settings={settings} kind="kitchen" /> : null}
          </div>
          <Card className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between"><h3 className="font-bold">پیش‌نمایش فیش</h3><Btn tone="ghost" onClick={() => setPrinted(null)}>بستن</Btn></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ReceiptView order={printed} settings={settings} kind="customer" />
              <ReceiptView order={printed} settings={settings} kind="kitchen" />
            </div>
            <div className="mt-2"><Btn onClick={() => window.print()}>چاپ فیش</Btn></div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function statusFa(s: Order["status"]) {
  return { new: "جدید", preparing: "در حال آماده‌سازی", ready: "آماده", delivered: "تحویل شد", cancelled: "لغو" }[s];
}

function OrdersScreen({ role }: { role: Role }) {
  const orders = usePos((s) => s.orders);
  const settings = usePos((s) => s.settings);
  const products = usePos((s) => s.products);
  const customers = usePos((s) => s.customers);
  const discounts = usePos((s) => s.discounts);
  const setStatus = usePos((s) => s.setStatus);
  const [focus, setFocus] = useState<Order | null>(null);
  const [clockNow, setClockNow] = useState(INITIAL_RENDER_TIME);
  useEffect(() => { queueMicrotask(() => setClockNow(Date.now())); const timer=window.setInterval(()=>setClockNow(Date.now()),30000); return ()=>window.clearInterval(timer); }, []);
  const [editing, setEditing] = useState<Order | null>(null);
  const [editLines, setEditLines] = useState<CartLine[]>([]);
  const [editPhone, setEditPhone] = useState("");
  const [editGuestName, setEditGuestName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editPoints, setEditPoints] = useState(0);
  const [editPayment, setEditPayment] = useState<Order["payment"]>("cash");
  const [addProductId, setAddProductId] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const steps: Order["status"][] = role === "kitchen"
    ? ["preparing", "ready"]
    : role === "manager" ? ["preparing", "ready", "delivered", "cancelled"] : [];
  const normalizedEditPhone = normalizeIranPhone(editPhone);
  const editCustomer = customers.find((c) => normalizeIranPhone(c.phone) === normalizedEditPhone) ?? null;
  const editCodeUses = editCustomer && editCode
    ? Math.max(0, customerCodeUses(orders, editCustomer.id, editCode) - (editing?.customerId === editCustomer.id && editing.discountCode.toUpperCase() === editCode.trim().toUpperCase() ? 1 : 0))
    : 0;
  const editQuoteCustomer = editCustomer && editing?.customerId === editCustomer.id
    ? { ...editCustomer, points: Math.max(0, editCustomer.points + editing.pointsUsed - editing.pointsEarned) }
    : editCustomer;
  const editDiscounts = discounts.map((discount) =>
    editing && discount.code.toUpperCase() === editing.discountCode.toUpperCase()
      ? { ...discount, usedCount: Math.max(0, discount.usedCount - 1) }
      : discount,
  );
  const editQuote = quoteOrder({
    lines: editLines,
    customer: editQuoteCustomer,
    code: editCode,
    discounts: editDiscounts,
    pointsToUse: editPoints,
    taxPercent: settings.taxPercent,
    taxEnabled: settings.taxEnabled !== false,
    tomanPerPoint: settings.tomanPerPoint,
    usesSoFar: editCodeUses,
    settings,
  });
  function beginEdit(order: Order) {
    setEditing(order);
    setEditLines(order.lines.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      const options = product?.options.filter((option) => line.optionIds.includes(option.id)) ?? [];
      return {
        ...line,
        name: product?.name ?? line.name,
        unitPrice: product ? product.price + options.reduce((sum, option) => sum + option.price, 0) : line.unitPrice,
        optionIds: [...line.optionIds],
        optionLabels: options.length ? options.map((option) => option.name) : [...line.optionLabels],
      };
    }));
    setEditPhone(order.customerPhone);
    setEditGuestName(order.customerName);
    setEditCode(order.discountCode);
    setEditPoints(order.pointsUsed);
    setEditPayment(order.payment);
    setAddProductId("");
  }
  function canMove(from: Order["status"], to: Order["status"]) {
    const allowed: Record<Order["status"], Order["status"][]> = {
      new: role === "manager" ? ["preparing", "cancelled"] : ["preparing"],
      preparing: role === "manager" ? ["ready", "cancelled"] : ["ready"],
      ready: role === "manager" ? ["delivered", "cancelled"] : [],
      delivered: [],
      cancelled: [],
    };
    return allowed[from].includes(to);
  }
  async function jump(order: Order, status: Order["status"]) {
    try {
      if (/^\d+$/.test(order.id)) await phpApi.setOrderStatus(order.id, status);
      setStatus(order.id, status);
      try {
        const snapshot = await phpApi.bootstrap<ServerBootstrap>();
        hydratePosFromServer(snapshot.data, snapshot.next_order, role);
      } catch {
        // The status transition is committed; the next poll refreshes the snapshot.
      }
      const next = { ...order, status };
      if (status === "ready") void pushSms("order_ready", order.customerPhone, orderVars(next));
      if (status === "delivered") void pushSms("order_delivered", order.customerPhone, orderVars(next));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "تغییر وضعیت در سرور انجام نشد");
    }
  }
  function addEditProduct() {
    const product = products.find((p) => p.id === addProductId && p.active);
    if (!product) return;
    if (product.options.length) {
      window.alert("برای افزودن این محصول ابتدا گزینه‌های آن باید در منو انتخاب شوند؛ می‌توانید اقلام فعلی را ویرایش کنید.");
      return;
    }
    const key = `edit:${product.id}`;
    setEditLines((current) => {
      const hit = current.find((line) => line.key === key);
      return hit
        ? current.map((line) => line.key === key ? { ...line, qty: line.qty + 1 } : line)
        : [...current, { key, productId: product.id, name: product.name, qty: 1, unitPrice: product.price, optionIds: [], optionLabels: [], note: "" }];
    });
    setAddProductId("");
  }
  async function saveEdit() {
    if (!editing || editBusy || !editLines.length) return;
    if (editing.payment !== "cash") {
      window.alert("ویرایش سفارش دارای پرداخت کارتخوان یا پرداخت آنلاین قدیمی تا تعیین‌تکلیف مالی و بازپرداخت امکان‌پذیر نیست.");
      return;
    }
    if (editCode.trim() && editQuote.codeError) { window.alert(editQuote.codeError); return; }
    if (editQuote.pointsError) { window.alert(editQuote.pointsError); return; }
    setEditBusy(true);
    try {
      await phpApi.updateOrder(editing.id, {
        items: editLines.map((line) => ({
          key: line.key,
          name: line.name,
          productId: line.productId,
          qty: line.qty,
          unitPrice: line.unitPrice,
          optionIds: line.optionIds,
          optionLabels: line.optionLabels,
          note: line.note,
        })),
        totals: {
          subtotal: editQuote.subtotal,
          tierDiscount: editQuote.tierDiscount,
          codeDiscount: editQuote.codeDiscount,
          pointsDiscount: editQuote.pointsDiscount,
          tax: editQuote.tax,
          total: editQuote.total,
        },
        customer: editCustomer ? { id: editCustomer.id } : undefined,
        discountCode: editQuote.discount?.code ?? "",
        note: editLines.map((line) => line.note).filter(Boolean).join(" | ").slice(0, 2000),
        guestName: editGuestName.trim() || "مشتری",
        guestPhone: editPhone.trim(),
        payment: editPayment,
      });
      try {
        const snapshot = await phpApi.bootstrap<ServerBootstrap>();
        hydratePosFromServer(snapshot.data, snapshot.next_order, role);
      } catch {
        // Save succeeded; periodic bootstrap will refresh the local order list.
      }
      setEditing(null);
      window.alert("ویرایش سفارش ذخیره شد.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "ویرایش سفارش در سرور انجام نشد");
    } finally {
      setEditBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <PageHeading title="مدیریت سفارش‌ها" description="وضعیت سفارش‌ها، زمان آماده‌سازی و فیش هر سفارش را پیگیری کنید." icon={<ChefHat size={20} />} />
      {orders.length === 0 ? <Empty text="هنوز سفارشی ثبت نشده" /> : null}
      {orders.map((o) => (
        <Card key={o.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">#{o.number.toLocaleString("fa-IR")} — {o.customerName}</p>
              <p className="text-sm text-muted">{o.lines.map((l) => `${l.qty} ${l.name}`).join(" · ")} — {money(o.total)}</p>
              <p className="text-xs text-muted">ثبت: {new Date(o.createdAt).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"})} · زمان سپری‌شده: {formatElapsed(clockNow-new Date(o.createdAt).getTime())}</p>
              {(o.status === "new" || o.status === "preparing") && clockNow - new Date(o.createdAt).getTime() >= Math.max(1, settings.orderDelayMinutes ?? 20) * 60000 ? <p className="mt-1 text-xs font-semibold text-warn">هشدار تأخیر سفارش · بیش از {Math.max(1, settings.orderDelayMinutes ?? 20).toLocaleString("fa-IR")} دقیقه</p> : null}
            </div>
            <span className={`order-status order-status-${o.status}`}>{statusFa(o.status)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {steps.filter((st) => canMove(o.status, st)).map((st) => <Btn key={st} tone="ghost" onClick={() => jump(o, st)}>{statusFa(st)}</Btn>)}
            {role === "manager" && o.status === "new" && o.payment === "cash" && /^\d+$/.test(o.id) ? <Btn tone="ghost" onClick={() => beginEdit(o)}>ویرایش سفارش</Btn> : null}
            <Btn tone="ghost" onClick={() => setFocus(o)}>فیش</Btn>
          </div>
        </Card>
      ))}
      {editing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-ink/50 p-3 sm:items-center">
          <Card className="my-auto w-full max-w-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">ویرایش سفارش #{editing.number.toLocaleString("fa-IR")}</h3>
              <Btn tone="ghost" onClick={() => setEditing(null)}>بستن</Btn>
            </div>
            <p className="text-xs text-muted">فقط سفارش جدید قابل ویرایش است؛ قیمت و موجودی نهایی در سرور دوباره بررسی می‌شود.</p>
            <div className="space-y-2">
              {editLines.map((line) => (
                <div key={line.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{line.name}</p>
                    <p className="text-xs text-muted">{line.optionLabels.join("، ")}</p>
                    <input className={inputCls + " mt-1"} aria-label={"یادداشت " + line.name} value={line.note} onChange={(e) => setEditLines((all) => all.map((x) => x.key === line.key ? { ...x, note: e.target.value } : x))} placeholder="یادداشت" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Btn tone="ghost" onClick={() => setEditLines((all) => all.flatMap((x) => x.key === line.key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x]))}>−</Btn>
                    <span className="min-w-7 text-center">{line.qty.toLocaleString("fa-IR")}</span>
                    <Btn tone="ghost" onClick={() => setEditLines((all) => all.map((x) => x.key === line.key ? { ...x, qty: x.qty + 1 } : x))}>+</Btn>
                    <Btn tone="ghost" onClick={() => setEditLines((all) => all.filter((x) => x.key !== line.key))}>حذف</Btn>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <select className={inputCls + " min-w-0 flex-1"} value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                <option value="">افزودن محصول ساده…</option>
                {products.filter((p) => p.active && p.options.length === 0).map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}
              </select>
              <Btn tone="ghost" onClick={addEditProduct} disabled={!addProductId}>افزودن</Btn>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="موبایل مشتری"><input className={inputCls} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></Field>
              {editCustomer ? <p className="self-end text-sm text-leaf">{editCustomer.name} — {editCustomer.points.toLocaleString("fa-IR")} امتیاز</p> : <Field label="نام مشتری مهمان"><input className={inputCls} value={editGuestName} onChange={(e) => setEditGuestName(e.target.value)} /></Field>}
              <Field label="کد تخفیف"><input className={inputCls} value={editCode} onChange={(e) => setEditCode(e.target.value)} /></Field>
              {editCustomer ? <Field label="امتیاز مصرفی"><input className={inputCls} type="number" min={0} value={editPoints} onChange={(e) => setEditPoints(Math.max(0, Number(e.target.value)))} /></Field> : null}
            </div>
            <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">روش پرداخت ثبت‌شده: {editing.payment === "cash" ? "نقد" : editing.payment === "card" ? "کارتخوان" : "آنلاین (قدیمی)"} — روش پرداخت پس از ثبت سفارش قابل تغییر نیست.</p>
            {editQuote.codeError ? <p className="text-sm text-warn">{editQuote.codeError}</p> : null}
            {editQuote.pointsError ? <p className="text-sm text-warn">{editQuote.pointsError}</p> : null}
            <div className="space-y-1 rounded-xl bg-surface p-3 text-sm">
              <p className="flex justify-between"><span>جمع اقلام</span><span>{money(editQuote.subtotal)}</span></p>
              <p className="flex justify-between"><span>تخفیف‌ها</span><span>{money(editQuote.tierDiscount + editQuote.codeDiscount + editQuote.pointsDiscount)}</span></p>
              <p className="flex justify-between font-bold"><span>قابل پرداخت</span><span>{money(editQuote.total)}</span></p>
            </div>
            <div className="flex gap-2">
              <Btn onClick={saveEdit} disabled={editBusy || !editLines.length || !!editQuote.pointsError || !!editQuote.codeError}>{editBusy ? "در حال ذخیره…" : "ذخیره ویرایش"}</Btn>
              <Btn tone="ghost" onClick={() => setEditing(null)} disabled={editBusy}>انصراف</Btn>
            </div>
          </Card>
        </div>
      ) : null}
      {focus ? (
        <Card>
          <div id="print-root" className="hidden print:block">
            <ReceiptView order={focus} settings={settings} kind="customer" />
            <ReceiptView order={focus} settings={settings} kind="kitchen" />
          </div>
          <ReceiptView order={focus} settings={settings} kind="customer" />
          <div className="mt-2 flex gap-2"><Btn onClick={() => window.print()}>چاپ</Btn><Btn tone="ghost" onClick={() => setFocus(null)}>بستن</Btn></div>
        </Card>
      ) : null}
    </div>
  );
}

function MenuScreen() {
  const categories = usePos((s) => s.categories);
  const products = usePos((s) => s.products);
  const ingredients = usePos((s) => s.ingredients);
  const saveCategory = usePos((s) => s.saveCategory);
  const saveProduct = usePos((s) => s.saveProduct);
  const removeProduct = usePos((s) => s.removeProduct);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Product | null>(null);
  const [productCategory, setProductCategory] = useState("all");
  const visibleProducts = products.filter((product) => productCategory === "all" || product.categoryId === productCategory);
  return (
    <div className="space-y-4">
      <PageHeading title="مدیریت منو و محصولات" description="دسته‌ها، قیمت‌ها و ترکیب مواد اولیه محصولات را یکپارچه مدیریت کنید." />
      <Card>
        <h3 className="mb-2 font-bold">دسته‌بندی</h3>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; const item = { id: uid("c"), name: name.trim() }; void saveCentralRecord("categories", item, () => saveCategory(item)).then((ok) => { if (ok) setName(""); }); }}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته" />
          <Btn type="submit">افزودن</Btn>
        </form>
        <p className="mt-2 text-sm text-muted">{categories.map((c) => c.name).join(" · ")}</p>
      </Card>
      <div className="flex justify-between"><h2 className="font-bold">محصولات</h2>
        <Btn onClick={() => setDraft({ id: uid("p"), name: "", categoryId: categories[0]?.id ?? "", price: 0, cost: 0, options: [], recipe: [], active: true })}>محصول جدید</Btn>
      </div>
      <Field label="فیلتر دسته‌بندی محصولات">
        <select className={inputCls} value={productCategory} onChange={(e) => setProductCategory(e.target.value)}>
          <option value="all">همه دسته‌ها</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </Field>
      {visibleProducts.map((p) => (
        <Card key={p.id} className="flex items-center justify-between gap-2">
          <div><p className="font-semibold">{p.name}</p><p className="text-sm text-muted">{money(p.price)} — تمام‌شده {money(p.cost)}</p></div>
          <div className="flex gap-2"><Btn tone="ghost" onClick={() => setDraft(p)}>ویرایش</Btn><Btn tone="ghost" onClick={() => void deleteCentralRecord("products", p.id, () => removeProduct(p.id))}>حذف</Btn></div>
        </Card>
      ))}
      {draft ? (
        <Card>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="نام"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="دسته"><select className={inputCls} value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="قیمت فروش"><input className={inputCls} type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></Field>
            <Field label="قیمت تمام‌شده"><input className={inputCls} type="number" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            محصول در صندوق فروش فعال باشد
          </label>
          <section className="space-y-2 sm:col-span-2" aria-label="گزینه‌ها و افزودنی‌های محصول">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">گزینه‌ها و افزودنی‌ها</p>
              <Btn tone="ghost" onClick={() => setDraft({ ...draft, options: [...draft.options, { id: uid("op"), name: "", price: 0 }] })}>افزودن گزینه</Btn>
            </div>
            {draft.options.length ? draft.options.map((option, index) => (
              <div key={option.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                <Field label={`نام گزینه ${index + 1}`}>
                  <input className={inputCls} value={option.name} onChange={(e) => setDraft({ ...draft, options: draft.options.map((item) => item.id === option.id ? { ...item, name: e.target.value } : item) })} placeholder="مثلاً پنیر اضافه" />
                </Field>
                <Field label="مبلغ اضافه (تومان)">
                  <input className={inputCls} type="number" min="0" max="100000000000" step="1" value={option.price} onChange={(e) => setDraft({ ...draft, options: draft.options.map((item) => item.id === option.id ? { ...item, price: Number(e.target.value) } : item) })} />
                </Field>
                <Field label="کسر از موجودی انبار">
                  <select className={inputCls} value={option.ingredientId ?? ""} onChange={(e) => {
                    const ingredientId = e.target.value;
                    setDraft({ ...draft, options: draft.options.map((item) => {
                      if (item.id !== option.id) return item;
                      if (!ingredientId) {
                        const { ingredientId: _ingredientId, ingredientQty: _ingredientQty, ...withoutIngredient } = item;
                        return withoutIngredient;
                      }
                      return { ...item, ingredientId, ingredientQty: item.ingredientQty && item.ingredientQty > 0 ? item.ingredientQty : 1 };
                    }) });
                  }}>
                    <option value="">بدون مصرف ماده اولیه</option>
                    {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                  </select>
                </Field>
                {option.ingredientId ? (
                  <Field label={"مقدار مصرف هر گزینه (" + (ingredients.find((item) => item.id === option.ingredientId)?.unit ?? "") + ")"}>
                    <input className={inputCls} type="number" min="0.001" max="1000000" step="0.001" value={option.ingredientQty ?? 1} onChange={(e) => setDraft({ ...draft, options: draft.options.map((item) => item.id === option.id ? { ...item, ingredientQty: Number(e.target.value) } : item) })} />
                  </Field>
                ) : null}
                <div className="flex items-end sm:col-span-2">
                  <Btn tone="ghost" onClick={() => setDraft({ ...draft, options: draft.options.filter((item) => item.id !== option.id) })}>حذف</Btn>
                </div>
              </div>
            )) : <p className="text-xs text-muted">برای این محصول گزینه یا افزودنی تعریف نشده است.</p>}
          </section>
          <p className="mt-3 text-sm font-semibold">مواد اولیه هر پرس</p>
          {ingredients.map((ing) => {
            const line = draft.recipe.find((r) => r.ingredientId === ing.id);
            return (
              <label key={ing.id} className="mt-1 flex items-center justify-between gap-2 text-sm">
                <span>{ing.name}</span>
                <input className={`${inputCls} max-w-28`} type="number" min="0" max="1000000" step="0.001" inputMode="decimal" aria-label={`مقدار ${ing.name} در هر پرس`} value={line?.qty ?? 0} onChange={(e) => {
                  const qty = Number(e.target.value);
                  const recipe = draft.recipe.filter((r) => r.ingredientId !== ing.id);
                  setDraft({ ...draft, recipe: qty > 0 ? [...recipe, { ingredientId: ing.id, qty }] : recipe });
                }} />
              </label>
            );
          })}
          <div className="mt-3 flex gap-2"><Btn onClick={() => { if (draft.name) void saveCentralRecord("products", draft, () => saveProduct(draft)).then((ok) => { if (ok) setDraft(products.some((item) => item.id === draft.id) ? null : { id: uid("p"), name: "", categoryId: draft.categoryId || categories[0]?.id || "", price: 0, cost: 0, options: [], recipe: [], active: true }); }); }}>ذخیره</Btn><Btn tone="ghost" onClick={() => setDraft(null)}>بستن</Btn></div>
        </Card>
      ) : null}
    </div>
  );
}

function StockScreen() {
  const ingredients = usePos((s) => s.ingredients);
  const saveIngredient = usePos((s) => s.saveIngredient);
  const lows = lowStock(ingredients);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("عدد");
  const [minimumStock, setMinimumStock] = useState("5");
  const [adjustmentAmount, setAdjustmentAmount] = useState("1");
  function adjustIngredient(id:string, direction:1|-1, commit:(item:typeof ingredients[number])=>void){
    const amount=Number(adjustmentAmount);
    if(!Number.isFinite(amount)||amount<=0||amount>1000000||Math.round(amount*1000)!==amount*1000){
      window.alert("مقدار تغییر باید مثبت و حداکثر سه رقم اعشار باشد.");
      return;
    }
    void adjustCentralStock<typeof ingredients[number]>(id,direction*amount,commit);
  }
  return (
    <div className="space-y-3">
      <PageHeading title="انبار مواد اولیه" description="موجودی، حد هشدار و تغییرات روزانه مواد اولیه را کنترل کنید." />
      {lows.length ? <Card className="bg-warn-bg text-warn">کمبود: {lows.map((i) => i.name).join("، ")}</Card> : <p className="text-sm text-leaf">موجودی بالای حد هشدار است.</p>}
      <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const minStock = Number(minimumStock);
        if (!Number.isFinite(minStock) || minStock < 0 || minStock > 1000000 || Math.round(minStock * 1000) !== minStock * 1000) {
          window.alert("حد هشدار باید عددی معتبر با حداکثر سه رقم اعشار باشد.");
          return;
        }
        const item = { id: uid("i"), name: name.trim(), unit, stock: 0, minStock, costPerUnit: 0 };
        void saveCentralRecord("ingredients", item, () => saveIngredient(item)).then((ok) => { if (ok) setName(""); });
      }}>
        <input className={inputCls} placeholder="ماده جدید" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="واحد" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <label className="space-y-1 text-xs text-muted"><span>حد هشدار موجودی</span><input className={inputCls} type="number" min="0" max="1000000" step="0.001" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} /></label>
        <Btn type="submit">افزودن</Btn>
      </form>
      {ingredients.map((i) => (
        <Card key={i.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{i.name}</p>
              <p className={`text-sm ${i.stock <= i.minStock ? "text-warn" : "text-muted"}`}>موجودی {i.stock.toLocaleString("fa-IR")} {i.unit} · حد هشدار {Number(i.minStock ?? 5).toLocaleString("fa-IR")} {i.unit}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`stock-adjust-${i.id}`}>مقدار تغییر موجودی {i.name}</label>
              <input id={`stock-adjust-${i.id}`} className={inputCls+" w-24"} type="number" min="0.001" max="1000000" step="0.001" inputMode="decimal" value={adjustmentAmount} onChange={event=>setAdjustmentAmount(event.target.value)} aria-label={`مقدار تغییر موجودی ${i.name}`}/>
              <Btn tone="ghost" onClick={() => {
                const raw = window.prompt("حد هشدار موجودی برای " + i.name, String(i.minStock ?? 0));
                if (raw === null) return;
                const minStock = Number(raw);
                if (!Number.isFinite(minStock) || minStock < 0 || minStock > 1000000 || Math.round(minStock * 1000) !== minStock * 1000) {
                  window.alert("حد هشدار باید عددی معتبر با حداکثر سه رقم اعشار باشد.");
                  return;
                }
                const updated = { ...i, minStock };
                void saveCentralRecord("ingredients", updated, () => saveIngredient(updated));
              }}>حد هشدار</Btn>
              <Btn tone="ghost" onClick={() => adjustIngredient(i.id,-1,saveIngredient)}>کاهش</Btn>
              <Btn tone="leaf" onClick={() => adjustIngredient(i.id,1,saveIngredient)}>افزایش</Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}


