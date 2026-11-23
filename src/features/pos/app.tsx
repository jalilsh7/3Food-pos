import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ChefHat, ClipboardList, LayoutDashboard, MessageSquare, Percent,
  Settings as SettingsIcon, ShoppingBag, Users, UtensilsCrossed, Warehouse, Truck, LogOut,
} from "lucide-react";
import { Btn, Card, Empty, Field, PageHeading, inputCls } from "./bits";
import { ReceiptView } from "./receipt";
import {
  customerCodeUses, fillTemplate, money, quoteOrder, TIER_LABEL, tierOf, uid,
  type CartLine, type DiscountCode, type Order, type Product, type Role, type SmsEvent, type PosState, type Settings, type SmsLog,
} from "@/lib/pos/model";
import { lowStock, usePos } from "@/lib/pos/store";
import { phpApi, type ApiUser } from "@/lib/api/php-client";
import { useAppearance } from "@/lib/appearance";
import { AppearanceSettingsPanel } from "./appearance-settings";

import { asciiDigits, isoToJalali, jalaliToIso } from "@/lib/iranian-date";
import { createXlsxBlob } from "@/lib/xlsx-export";
import { normalizeIranPhone, tehranDate, formatElapsed } from "@/lib/pos/formatters";
import { UsersScreen } from "./users-screen";
import { AuthFrame, PhpLoginScreen, ChangePasswordScreen } from "./auth-screens";
import { TerminalSettingsPanel } from "./terminal-settings";
import { SmsScreen } from "./sms-screen";
import { SuppliersScreen } from "./suppliers-screen";

type ExpenseCategory = { id: string; name: string; active?: boolean };

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
  const current = allowed.some((n) => n.id === view) ? view : allowed[0]?.id ?? "orders";
  return (
    <div className="pos-layout mx-auto grid w-full max-w-[1600px] min-w-0 gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-6 lg:px-7 lg:py-7">
      <nav className="pos-nav min-w-0 lg:sticky lg:top-[92px] lg:flex lg:h-[calc(100vh-116px)] lg:flex-col">
        <div className="hidden px-3 pb-4 pt-2 lg:block">
          <p className="text-[10px] font-bold tracking-[0.18em] text-muted">WORKSPACE</p>
          <p className="mt-1 text-sm font-extrabold">دسترسی سریع</p>
        </div>
        <div className="pos-nav-list flex min-w-0 gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {allowed.map((n) => {
            const Icon = n.icon;
            const on = current === n.id;
            return (
              <button key={n.id} type="button" aria-current={on ? "page" : undefined} onClick={() => setView(n.id)} className={`pos-nav-item inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${on ? "is-active" : ""}`}>
                <span className="grid h-8 w-8 place-items-center rounded-xl"><Icon size={18} strokeWidth={2} /></span>
                <span>{n.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-auto hidden rounded-2xl border border-line bg-surface/80 p-4 lg:block">
          <p className="text-xs font-bold text-ink">3Food POS</p>
          <p className="mt-1 text-[11px] leading-6 text-muted">مدیریت یکپارچه فروش، سفارش و موجودی</p>
          <span className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold text-leaf"><span className="h-1.5 w-1.5 rounded-full bg-leaf" /> سامانه فعال</span>
        </div>
      </nav>
      <main className="pos-main min-w-0">
        {current === "pos" ? <PosScreen /> : null}
        {current === "orders" ? <OrdersScreen role={role} /> : null}
        {current === "menu" ? <MenuScreen /> : null}
        {current === "stock" ? <StockScreen /> : null}
        {current === "customers" ? <CustomersScreen role={role} /> : null}
        {current === "codes" ? <CodesScreen /> : null}
        {current === "reports" ? <ReportsScreen /> : null}
        {current === "expenses" ? <ExpensesScreen /> : null}
        {current === "suppliers" ? <SuppliersScreen saveCentralRecord={saveCentralRecord} onPurchaseSaved={async () => { const snapshot = await phpApi.bootstrap<ServerBootstrap>(); hydratePosFromServer(snapshot.data, snapshot.next_order, "manager"); }} /> : null}
        {current === "sms" ? <SmsScreen sendRaw={sendRaw} saveCentralRecord={saveCentralRecord} /> : null}
        {current === "users" ? <UsersScreen /> : null}
        {current === "settings" ? <SettingsScreen /> : null}
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

function PosScreen() {
  const categories = usePos((s) => s.categories);
  const ingredients = usePos((s) => s.ingredients);
  const customers = usePos((s) => s.customers);
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
        const created=await phpApi.createTerminalPayment({terminalId:terminal.id,amount,idempotencyKey:crypto.randomUUID()});
        pending={id:created.payment.id,amount,terminalId:terminal.id};pendingTerminalPayment.current=pending;
      }
    }
    for(let attempt=0;attempt<60;attempt++){
      const result=await phpApi.getTerminalPayment(pending.id);
      const status=result.payment.status;
      if(status==="approved")return pending.id;
      if(status==="declined")throw new Error("بانک تراکنش را رد کرد. مبلغی به‌عنوان پرداخت موفق ثبت نشد.");
      if(status==="cancelled")throw new Error("تراکنش کارتخوان لغو شد.");
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
      const res = placeOrder({
        lines: cart, customer: checkoutCustomer, code, pointsToUse: points, taxEnabled: settings.taxEnabled !== false, payment: pay,
        guestName, guestPhone: phone.trim(),
        serverOrder: { id: server.order.id, number: server.order.orderNumber, createdAt: server.order.createdAt },
      });
      if (!res.ok) {
        setMsg(`سفارش در سرور ثبت شد اما همگام‌سازی محلی انجام نشد: ${res.error}. صفحه را تازه‌سازی کنید.`);
        return;
      }
      pendingIdempotencyKey.current = null;
      pendingTerminalPayment.current = null;
      setMsg(`سفارش ${res.order.number.toLocaleString("fa-IR")} ثبت شد`);
      setCart([]); setPhone(""); setGuestName("مشتری عزیز"); setCode(""); setPoints(0); setSendInvoiceSms(null); setPrinted(res.order);
      const fresh = usePos.getState().customers.find((c) => c.id === res.order.customerId);
      const vars = orderVars(res.order, String(fresh?.points ?? 0));
      void pushSms("order_created", res.order.customerPhone, vars);
      if (shouldSendInvoiceSms && res.order.customerPhone) {
        const invoice = [`${settings.shopName} - فاکتور سفارش ${res.order.number}`, ...res.order.lines.map(line => `${line.name} × ${line.qty}: ${money(line.unitPrice * line.qty)}`), `جمع: ${money(res.order.subtotal)}`, `تخفیف: ${money(res.order.tierDiscount + res.order.codeDiscount + res.order.pointsDiscount)}`, `مالیات: ${money(res.order.tax)}`, `مبلغ نهایی: ${money(res.order.total)}`, `تاریخ: ${new Date(res.order.createdAt).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"})}`].join("\n").slice(0, 950);
        void postSms(res.order.customerPhone, invoice, "order_invoice", "");
      }
      if (res.order.pointsEarned) void pushSms("points_earned", res.order.customerPhone, vars);
      if (res.order.discountCode) void pushSms("discount_used", res.order.customerPhone, vars);
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
  const editCustomer = customers.find((c) => c.phone === editPhone.trim()) ?? null;
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
      <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; const item = { id: uid("i"), name: name.trim(), unit, stock: 0, minStock: 5, costPerUnit: 0 }; void saveCentralRecord("ingredients", item, () => saveIngredient(item)).then((ok) => { if (ok) setName(""); }); }}>
        <input className={inputCls} placeholder="ماده جدید" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="واحد" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <Btn type="submit">افزودن</Btn>
      </form>
      {ingredients.map((i) => (
        <Card key={i.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{i.name}</p>
              <p className={`text-sm ${i.stock <= i.minStock ? "text-warn" : "text-muted"}`}>موجودی {i.stock.toLocaleString("fa-IR")} {i.unit}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`stock-adjust-${i.id}`}>مقدار تغییر موجودی {i.name}</label>
              <input id={`stock-adjust-${i.id}`} className={inputCls+" w-24"} type="number" min="0.001" max="1000000" step="0.001" inputMode="decimal" value={adjustmentAmount} onChange={event=>setAdjustmentAmount(event.target.value)} aria-label={`مقدار تغییر موجودی ${i.name}`}/>
              <Btn tone="ghost" onClick={() => adjustIngredient(i.id,-1,saveIngredient)}>کاهش</Btn>
              <Btn tone="leaf" onClick={() => adjustIngredient(i.id,1,saveIngredient)}>افزایش</Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CustomersScreen({ role }: { role: Role }) {
  const customers = usePos((s) => s.customers);
  const settings = usePos((s) => s.settings);
  const patchSettings = usePos((s) => s.patchSettings);
  const orders = usePos((s) => s.orders);
  const saveCustomer = usePos((s) => s.saveCustomer);
  const [q, setQ] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", birthday: "", smsConsent: false });
  const normalizedQuery=normalizeIranPhone(q);
  const list = customers.filter((c) => c.name.includes(q) || (normalizedQuery.length>0 && normalizeIranPhone(c.phone).includes(normalizedQuery)));
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const selectedOrders = selectedCustomer
    ? orders.filter((order) => order.customerId === selectedCustomer.id || normalizeIranPhone(order.customerPhone) === normalizeIranPhone(selectedCustomer.phone))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];
  return (
    <div className="space-y-3">
      <PageHeading title="باشگاه مشتریان" description="اعضا، سوابق خرید و امتیازهای وفاداری را مدیریت کنید." />
      <p className="text-sm text-muted">سطوح عضویت: نقره از {Number(settings.loyaltySilverPoints??500).toLocaleString("fa-IR")} امتیاز ({settings.loyaltySilverDiscount??3}٪)، طلا از {Number(settings.loyaltyGoldPoints??1500).toLocaleString("fa-IR")} ({settings.loyaltyGoldDiscount??5}٪)، پلاتین از {Number(settings.loyaltyPlatinumPoints??4000).toLocaleString("fa-IR")} ({settings.loyaltyPlatinumDiscount??8}٪).</p>
      {role === "manager" ? (
        <Card>
          <h3 className="mb-2 font-semibold">تنظیمات امتیازدهی باشگاه</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="به‌ازای هر چند تومان خرید، یک امتیاز؟">
              <input className={inputCls} type="number" min="1" value={settings.pointsPerToman} onChange={(e) => patchSettings({ pointsPerToman: Math.max(1, Number(e.target.value)) })} onBlur={() => {
                const current = usePos.getState().settings;
                void saveCentralRecord("settings", { id: "main", ...current, smsUser: "", smsKey: "", smsFrom: "" }, () => {});
              }} />
            </Field>
            <Field label="ارزش هر امتیاز به تومان">
              <input className={inputCls} type="number" min="1" value={settings.tomanPerPoint} onChange={(e) => patchSettings({ tomanPerPoint: Math.max(1, Number(e.target.value)) })} onBlur={() => {
                const current = usePos.getState().settings;
                void saveCentralRecord("settings", { id: "main", ...current, smsUser: "", smsKey: "", smsFrom: "" }, () => {});
              }} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">این نرخ‌ها برای تمام صندوق‌ها و کاربران یکسان اعمال می‌شود.</p>
        </Card>
      ) : null}
      <Card>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          if (!form.phone) return;
          const item = { id: uid("cu"), name: form.name || "بدون نام", phone: form.phone, points: 0, birthday: form.birthday, smsConsent: form.smsConsent, totalSpent: 0, visits: 0, createdAt: new Date().toISOString() };
          void saveCentralRecord("customers", item, () => saveCustomer(item)).then((ok) => { if (ok) setForm({ name: "", phone: "", birthday: "", smsConsent: false }); });
        }}>
          <input className={inputCls} placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="موبایل" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={inputCls} type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.smsConsent} onChange={e=>setForm({...form,smsConsent:e.target.checked})}/>رضایت دریافت پیامک تبلیغاتی</label>
          <Btn type="submit">عضویت</Btn>
        </form>
      </Card>
      <input className={inputCls} placeholder="جستجو با شماره موبایل یا نام خانوادگی" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <div><p className="font-bold">{c.name}</p><p className="text-sm text-muted">{c.phone}</p></div>
            <p className="text-sm">{TIER_LABEL[tierOf(c.points,settings)]} — {c.points.toLocaleString("fa-IR")} امتیاز — {money(c.totalSpent)}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={c.smsConsent === true} onChange={e=>{const updated={...c,smsConsent:e.target.checked};void saveCentralRecord("customers",updated,()=>saveCustomer(updated));}}/>رضایت پیامک تبلیغاتی</label>
            <p className="text-xs text-muted">{orders.filter((o) => o.customerId === c.id || normalizeIranPhone(o.customerPhone) === normalizeIranPhone(c.phone)).length.toLocaleString("fa-IR")} سفارش ثبت‌شده</p>
            <Btn tone="ghost" onClick={() => setSelectedCustomerId(selectedCustomerId === c.id ? null : c.id)}>{selectedCustomerId === c.id ? "بستن سوابق" : "گزارش خریدها"}</Btn>
          </div>
        </Card>
      ))}
      {selectedCustomer ? (
        <Card>
          <h3 className="font-bold">سوابق خرید {selectedCustomer.name}</h3>
          <p className="mt-1 text-sm text-muted">موبایل: {selectedCustomer.phone} — مجموع خرید: {money(selectedCustomer.totalSpent)} — {selectedOrders.length.toLocaleString("fa-IR")} سفارش</p>
          {selectedOrders.length ? (
            <div className="mt-3 space-y-2">
              {selectedOrders.map((order) => (
                <div key={order.id} className="flex flex-wrap justify-between gap-2 border-t border-line pt-2 text-sm">
                  <span>سفارش {order.number.toLocaleString("fa-IR")} — {new Date(order.createdAt).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"})}</span>
                  <span className="font-semibold">{money(order.total)}{order.status === "cancelled" ? " — لغو شده" : ""}</span>
                </div>
              ))}
            </div>
          ) : <Empty text="سفارشی برای این مشتری ثبت نشده است." />}
        </Card>
      ) : null}
    </div>
  );
}

function emptyCode(): DiscountCode {
  return { id: uid("d"), code: "", type: "percent", value: 10, maxDiscount: 50000, minOrder: 0, maxUses: 0, usedCount: 0, perCustomer: 1, startsAt: new Date().toISOString().slice(0, 10), endsAt: "2026-12-31", audience: "all" };
}

function CodesScreen() {
  const discounts = usePos((s) => s.discounts);
  const saveDiscount = usePos((s) => s.saveDiscount);
  const removeDiscount = usePos((s) => s.removeDiscount);
  const [draft, setDraft] = useState<DiscountCode | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex justify-between"><PageHeading title="کدهای تخفیف" description="کمپین‌های تخفیف را با محدودیت و شرایط استفاده تعریف کنید." /><Btn onClick={() => setDraft(emptyCode())}>کد جدید</Btn></div>
      {discounts.map((d) => (
        <Card key={d.id} className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold">{d.code}</p>
            <p className="text-sm text-muted">{d.type === "percent" ? `${d.value}٪` : money(d.value)} — استفاده {d.usedCount.toLocaleString("fa-IR")}{d.maxUses ? ` از ${d.maxUses.toLocaleString("fa-IR")}` : " (نامحدود)"}</p>
          </div>
          <div className="flex gap-2"><Btn tone="ghost" onClick={() => setDraft(d)}>ویرایش</Btn><Btn tone="ghost" onClick={() => void deleteCentralRecord("discounts", d.id, () => removeDiscount(d.id))}>حذف</Btn></div>
        </Card>
      ))}
      {draft ? (
        <Card>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="کد"><input className={inputCls} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="نوع"><select className={inputCls} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DiscountCode["type"] })}><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select></Field>
            <Field label="مقدار"><input className={inputCls} type="number" value={draft.value} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })} /></Field>
            <Field label="سقف تخفیف"><input className={inputCls} type="number" value={draft.maxDiscount} onChange={(e) => setDraft({ ...draft, maxDiscount: Number(e.target.value) })} /></Field>
            <Field label="حداقل سفارش"><input className={inputCls} type="number" value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: Number(e.target.value) })} /></Field>
            <Field label="سقف کل (۰ نامحدود)"><input className={inputCls} type="number" value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: Number(e.target.value) })} /></Field>
            <Field label="سقف هر مشتری"><input className={inputCls} type="number" value={draft.perCustomer} onChange={(e) => setDraft({ ...draft, perCustomer: Number(e.target.value) })} /></Field>
            <Field label="مخاطب">
              <select className={inputCls} value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as DiscountCode["audience"] })}>
                <option value="all">همه</option><option value="club">فقط باشگاه</option>
                <option value="bronze">برنز</option><option value="silver">نقره</option><option value="gold">طلا</option><option value="platinum">پلاتین</option>
              </select>
            </Field>
            <Field label="از"><input className={inputCls} type="date" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></Field>
            <Field label="تا"><input className={inputCls} type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></Field>
          </div>
          <div className="mt-3 flex gap-2"><Btn onClick={() => { if (draft.code) void saveCentralRecord("discounts", draft, () => saveDiscount(draft)).then((ok) => { if (ok) setDraft(null); }); }}>ذخیره</Btn><Btn tone="ghost" onClick={() => setDraft(null)}>بستن</Btn></div>
        </Card>
      ) : null}
    </div>
  );
}

const REPORT_INITIAL_TO = tehranDate();
const REPORT_INITIAL_FROM = tehranDate(Date.now() - 6 * 86400000);

function ReportsScreen() {
  const orders = usePos((s) => s.orders);
  const expenses = usePos((s) => s.expenses);
  const products = usePos((s) => s.products);
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
    void loadExpenseCategories()
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
    const ok=await saveCentralRecord("expense_categories",item,()=>setCategories(old=>[...old,item]));
    if(ok){setNewCategory("");setCat(name);}setCategoryBusy(false);
  }
  async function editCategory(category:{id:string;name:string;active?:boolean}){
    const name=window.prompt("ویرایش نام دسته هزینه",category.name);if(name===null||!name.trim())return;
    const updated={...category,name:name.trim()};
    if(categories.some(item=>item.id!==category.id&&item.name===updated.name)){window.alert("دسته‌ای با این نام وجود دارد.");return;}
    const ok=await saveCentralRecord("expense_categories",updated,()=>{
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
    await deleteCentralRecord("expense_categories",category.id,()=>setCategories(old=>old.filter(c=>c.id!==category.id)));
  }
  async function editExpense(expense:typeof expenses[number]){
    const title=window.prompt("شرح هزینه",expense.title);if(title===null||!title.trim())return;
    const raw=window.prompt("مبلغ هزینه (تومان)",String(expense.amount));if(raw===null)return;
    const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0){window.alert("مبلغ معتبر نیست.");return;}
    const updated={...expense,title:title.trim(),amount};
    if(await saveCentralRecord("expenses",updated,()=>saveExpense(updated))) await refreshServerReport();
  }
  async function deleteExpense(expense:typeof expenses[number]){
    if(!window.confirm("هزینه «"+expense.title+"» حذف شود؟"))return;
    if(await deleteCentralRecord("expenses",expense.id,()=>removeExpense(expense.id))) await refreshServerReport();
  }
  async function addCost(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!title.trim()||amount<=0||!cat)return;
    const item={id:uid("ex"),title:title.trim(),amount,category:cat,date:expenseDate,note:note.trim(),createdAt:new Date().toISOString()};
    const ok=await saveCentralRecord("expenses",item,()=>addExpense(item));
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

function ExpensesScreen(){
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
  useEffect(()=>{let active=true;void loadExpenseCategories().then(items=>{if(active){setCategories(items);setCategory(items.find(item=>item.active!==false)?.name??"");}}).catch(()=>{if(active)setCategories([]);});return()=>{active=false;};},[]);
  const visible=expenses.filter(item=>(filter==="all"||item.category===filter)).sort((a,b)=>b.date.localeCompare(a.date));
  const total=visible.reduce((sum,item)=>sum+item.amount,0);
  async function add(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!title.trim()||amount<=0||!category)return;const item={id:uid("ex"),title:title.trim(),amount,category,date,note:note.trim(),createdAt:new Date().toISOString()};const ok=await saveCentralRecord("expenses",item,()=>addExpense(item));if(ok){setTitle("");setAmount(0);setNote("");setDate(tehranDate());}}
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
    if(await deleteCentralRecord("expense_categories",item.id,()=>setCategories(old=>old.filter(category=>category.id!==item.id)))){
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
