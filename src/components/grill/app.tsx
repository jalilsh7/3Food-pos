import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ChefHat, ClipboardList, LayoutDashboard, MessageSquare, Percent,
  Settings as SettingsIcon, ShoppingBag, Users, UtensilsCrossed, Warehouse,
} from "lucide-react";
import { Btn, Card, Empty, Field, inputCls } from "./bits";
import { ReceiptView } from "./receipt";
import {
  customerCodeUses, fillTemplate, money, quoteOrder, TIER_LABEL, TIER_OFF, tierOf, uid,
  type CartLine, type DiscountCode, type Order, type Product, type Role, type SmsEvent, type PosState, type Settings, type SmsLog,
} from "@/lib/pos/model";
import { lowStock, usePos } from "@/lib/pos/store";
import { phpApi, type ApiUser, type ManagedUser } from "@/lib/api/php-client";


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

type View = "pos" | "orders" | "menu" | "stock" | "customers" | "codes" | "reports" | "sms" | "users" | "settings";

const NAV: { id: View; label: string; icon: typeof ShoppingBag; roles: Role[] }[] = [
  { id: "pos", label: "فروش", icon: ShoppingBag, roles: ["manager", "cashier"] },
  { id: "orders", label: "سفارش‌ها", icon: ClipboardList, roles: ["manager", "cashier", "kitchen"] },
  { id: "menu", label: "منو", icon: UtensilsCrossed, roles: ["manager"] },
  { id: "stock", label: "انبار", icon: Warehouse, roles: ["manager"] },
  { id: "customers", label: "باشگاه", icon: Users, roles: ["manager", "cashier"] },
  { id: "codes", label: "کد تخفیف", icon: Percent, roles: ["manager"] },
  { id: "reports", label: "گزارش", icon: LayoutDashboard, roles: ["manager"] },
  { id: "sms", label: "پیامک", icon: MessageSquare, roles: ["manager"] },
  { id: "users", label: "کاربران", icon: Users, roles: ["manager"] },
  { id: "settings", label: "تنظیمات", icon: SettingsIcon, roles: ["manager"] },
];

const ROLE_LABEL: Record<Role, string> = { manager: "مدیر", cashier: "صندوقدار", kitchen: "آشپز" };
const EVENT_LABEL: Record<SmsEvent, string> = {
  order_created: "ثبت سفارش", order_ready: "آماده شدن", order_delivered: "تحویل",
  points_earned: "کسب امتیاز", discount_used: "استفاده از کد",
};

export function GrillApp() {
  const shop = usePos((s) => s.settings.shopName);
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
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div>
          <p className="text-lg font-bold">{shop}</p>
          <p className="text-xs text-muted">{user.display_name} — {ROLE_LABEL[user.role]}</p>
        </div>
        <button type="button" onClick={() => void logout()} className="rounded-xl border border-line px-3 py-2 text-sm">خروج امن</button>
      </header>
      <PosWorkspace allowed={allowed} initialView={viewFallback?.id ?? "orders"} role={user.role} />
    </div>
  );
}

function PosWorkspace({ allowed, initialView, role }: { allowed: typeof NAV; initialView: View; role: Role }) {
  const [view, setView] = useState<View>(initialView);
  const current = allowed.some((n) => n.id === view) ? view : allowed[0]?.id ?? "orders";
  return (
    <div className="mx-auto grid min-w-0 max-w-6xl gap-4 px-3 py-4 lg:grid-cols-[180px_1fr]">
      <nav className="grid min-w-0 grid-cols-3 gap-2 lg:flex lg:flex-col">
        {allowed.map((n) => {
          const Icon = n.icon;
          const on = current === n.id;
          return (
            <button key={n.id} onClick={() => setView(n.id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${on ? "bg-chili text-chili-ink" : "bg-surface text-ink border border-line"}`}>
              <Icon size={18} />{n.label}
            </button>
          );
        })}
      </nav>
      <main className="min-w-0">
        {current === "pos" ? <PosScreen /> : null}
        {current === "orders" ? <OrdersScreen role={role} /> : null}
        {current === "menu" ? <MenuScreen /> : null}
        {current === "stock" ? <StockScreen /> : null}
        {current === "customers" ? <CustomersScreen /> : null}
        {current === "codes" ? <CodesScreen /> : null}
        {current === "reports" ? <ReportsScreen /> : null}
        {current === "sms" ? <SmsScreen /> : null}
        {current === "users" ? <UsersScreen /> : null}
        {current === "settings" ? <SettingsScreen /> : null}
      </main>
    </div>
  );
}

function UsersScreen() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ username: "", display_name: "", password: "", role: "cashier" as Role });

  async function refresh() {
    setLoading(true);
    try {
      const result = await phpApi.listUsers();
      setUsers(result.users);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "دریافت کاربران انجام نشد");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await phpApi.createUser(draft);
      setDraft({ username: "", display_name: "", password: "", role: "cashier" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ساخت حساب انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function changeUser(user: ManagedUser, patch: Partial<Pick<ManagedUser, "role" | "is_active">>) {
    setBusy(true);
    setError("");
    try {
      await phpApi.updateUser(user.id, patch);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر حساب انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold">مدیریت کاربران</h2>
      <Card>
        <h3 className="mb-3 font-semibold">ساخت حساب جدید</h3>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
          <Field label="نام کاربری"><input className={inputCls} minLength={4} maxLength={64} pattern="[A-Za-z0-9._-]+" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} required /></Field>
          <Field label="نام نمایشی"><input className={inputCls} maxLength={120} value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} required /></Field>
          <Field label="رمز اولیه (حداقل ۱۲ نویسه)"><input className={inputCls} type="password" minLength={12} maxLength={200} autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required /></Field>
          <Field label="نقش"><select className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}><option value="cashier">صندوقدار</option><option value="kitchen">آشپز</option><option value="manager">مدیر</option></select></Field>
          <div className="sm:col-span-2"><Btn type="submit" disabled={busy}>{busy ? "در حال ذخیره..." : "ساخت حساب"}</Btn></div>
        </form>
      </Card>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">در حال دریافت کاربران...</p> : users.map((user) => (
        <Card key={user.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{user.display_name} — {user.username}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]} · {user.is_active ? "فعال" : "غیرفعال"}{user.must_change_password ? " · نیازمند تغییر رمز" : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={inputCls} aria-label="نقش کاربر" value={user.role} disabled={busy} onChange={(e) => void changeUser(user, { role: e.target.value as Role })}>
                <option value="cashier">صندوقدار</option><option value="kitchen">آشپز</option><option value="manager">مدیر</option>
              </select>
              <Btn tone="ghost" disabled={busy} onClick={() => void changeUser(user, { is_active: !user.is_active })}>{user.is_active ? "غیرفعال‌کردن" : "فعال‌کردن"}</Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-bg p-4"><Card>{children}</Card></div>;
}

function PhpLoginScreen({ setupRequired, onAuthenticated }: { setupRequired: boolean; onAuthenticated: (user: ApiUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("مدیر");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = setupRequired
        ? await phpApi.setupManager({ username, password, display_name: displayName, setupToken })
        : await phpApi.login(username, password);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={(event) => void submit(event)} className="w-full min-w-[min(84vw,360px)] space-y-3">
        <h1 className="text-xl font-bold">{setupRequired ? "راه‌اندازی مدیر اصلی" : "ورود به صندوق"}</h1>
        {setupRequired ? <>
          <Field label="نام نمایشی"><input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></Field>
          <Field label="توکن یک‌بارمصرف راه‌اندازی"><input className={inputCls} type="password" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} required autoComplete="off" /></Field>
        </> : null}
        <Field label="نام کاربری"><input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></Field>
        <Field label="رمز عبور"><input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={setupRequired ? "new-password" : "current-password"} minLength={setupRequired ? 12 : undefined} required /></Field>
        {error ? <p className="text-sm text-warn">{error}</p> : null}
        <button disabled={busy} className="w-full rounded-xl bg-ink px-4 py-3 font-semibold text-bg disabled:opacity-50">{busy ? "در حال انجام..." : setupRequired ? "ساخت مدیر" : "ورود امن"}</button>
      </form>
    </AuthFrame>
  );
}

function ChangePasswordScreen({ user, onChanged }: { user: ApiUser; onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await phpApi.changePassword(current, next);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر رمز انجام نشد");
    } finally {
      setBusy(false);
    }
  }
  return <AuthFrame><form onSubmit={(event) => void submit(event)} className="w-full min-w-[min(84vw,360px)] space-y-3">
    <h1 className="text-xl font-bold">تغییر رمز عبور</h1>
    <p className="text-sm text-muted">{user.display_name}، پیش از ادامه باید رمز خود را تغییر دهید.</p>
    <Field label="رمز فعلی"><input className={inputCls} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
    <Field label="رمز جدید (حداقل ۱۲ نویسه)"><input className={inputCls} type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={12} required /></Field>
    {error ? <p className="text-sm text-warn">{error}</p> : null}
    <button disabled={busy} className="w-full rounded-xl bg-ink px-4 py-3 font-semibold text-bg disabled:opacity-50">{busy ? "در حال ذخیره..." : "ذخیره رمز جدید"}</button>
  </form></AuthFrame>;
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
  if (!phone || !text) return;
  await postSms(phone, text, "manual", "");
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
}

function PosScreen() {
  const products = usePos((s) => s.products);
  const categories = usePos((s) => s.categories);
  const customers = usePos((s) => s.customers);
  const discounts = usePos((s) => s.discounts);
  const orders = usePos((s) => s.orders);
  const settings = usePos((s) => s.settings);
  const placeOrder = usePos((s) => s.placeOrder);
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [code, setCode] = useState("");
  const [points, setPoints] = useState(0);
  const [pay, setPay] = useState<Order["payment"]>("cash");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pendingIdempotencyKey = useRef<string | null>(null);
  const [printed, setPrinted] = useState<Order | null>(null);
  const [optFor, setOptFor] = useState<Product | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const customer = customers.find((c) => c.phone === phone.trim()) ?? null;
  const uses = customer && code ? customerCodeUses(orders, customer.id, code) : 0;
  const q = quoteOrder({ lines: cart, customer, code, discounts, pointsToUse: points, taxPercent: settings.taxPercent, taxEnabled: settings.taxEnabled, tomanPerPoint: settings.tomanPerPoint, usesSoFar: uses });

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

  async function checkout() {
    if (submitting || !cart.length) return;
    if (code.trim() && q.codeError) { setMsg(q.codeError); return; }
    if (q.pointsError) { setMsg(q.pointsError); return; }
    setSubmitting(true);
    setMsg("");
    try {
      const idempotencyKey = pendingIdempotencyKey.current ?? crypto.randomUUID();
      pendingIdempotencyKey.current = idempotencyKey;
      const server = await phpApi.createOrder<{ id: string; orderNumber: number }>({
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
        customer: customer ? { id: customer.id } : undefined,
        discountCode: q.discount?.code ?? '',
        note: cart.map((line) => line.note).filter(Boolean).join(" | ").slice(0, 2000),
        guestName,
        guestPhone: phone.trim(),
        payment: pay,
      });
      const res = placeOrder({
        lines: cart, customer, code, pointsToUse: points, taxEnabled: settings.taxEnabled !== false, payment: pay,
        guestName, guestPhone: phone.trim(),
        serverOrder: { id: server.order.id, number: server.order.orderNumber },
      });
      if (!res.ok) {
        setMsg(`سفارش در سرور ثبت شد اما همگام‌سازی محلی انجام نشد: ${res.error}. صفحه را تازه‌سازی کنید.`);
        return;
      }
      pendingIdempotencyKey.current = null;
      setMsg(`سفارش ${res.order.number.toLocaleString("fa-IR")} ثبت شد`);
      setCart([]); setCode(""); setPoints(0); setPrinted(res.order);
      const fresh = usePos.getState().customers.find((c) => c.id === res.order.customerId);
      const vars = orderVars(res.order, String(fresh?.points ?? 0));
      void pushSms("order_created", res.order.customerPhone, vars);
      if (res.order.pointsEarned) void pushSms("points_earned", res.order.customerPhone, vars);
      if (res.order.discountCode) void pushSms("discount_used", res.order.customerPhone, vars);
      if (settings.autoPrint) setTimeout(() => window.print(), 300);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "ثبت سفارش در سرور انجام نشد");
    } finally {
      setSubmitting(false);
    }
  }

  const shown = products.filter((p) => p.active && (!cat || p.categoryId === cat));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex min-w-0 flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full px-4 py-2 text-sm ${cat === c.id ? "bg-ink text-bg" : "bg-surface border border-line"}`}>{c.name}</button>
          ))}
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
          <Field label="موبایل مشتری"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912..." /></Field>
          {customer ? (
            <p className="rounded-xl bg-leaf-ink px-3 py-2 text-sm text-leaf">{customer.name} — {TIER_LABEL[tierOf(customer.points)]} ({customer.points.toLocaleString("fa-IR")} امتیاز، تخفیف {TIER_OFF[tierOf(customer.points)].toLocaleString("fa-IR")}٪)</p>
          ) : (
            <Field label="نام (اگر عضو نیست)"><input className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} /></Field>
          )}
          <Field label="کد تخفیف"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME" /></Field>
          {q.codeError ? <p className="text-sm text-warn">{q.codeError}</p> : null}
          {customer ? <Field label="استفاده از امتیاز"><input className={inputCls} type="number" min={0} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></Field> : null}
          {q.pointsError ? <p className="text-sm text-warn">{q.pointsError}</p> : null}
          <div className="flex gap-2">
            {(["cash", "card", "online"] as const).map((p) => (
              <button key={p} onClick={() => setPay(p)} className={`flex-1 rounded-xl py-3 text-sm ${pay === p ? "bg-ink text-bg" : "border border-line"}`}>{p === "cash" ? "نقد" : p === "card" ? "کارت" : "آنلاین"}</button>
            ))}
          </div>
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
      <h2 className="flex items-center gap-2 text-xl font-bold"><ChefHat size={20} /> سفارش‌ها</h2>
      {orders.length === 0 ? <Empty text="هنوز سفارشی ثبت نشده" /> : null}
      {orders.map((o) => (
        <Card key={o.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">#{o.number.toLocaleString("fa-IR")} — {o.customerName}</p>
              <p className="text-sm text-muted">{o.lines.map((l) => `${l.qty} ${l.name}`).join(" · ")} — {money(o.total)}</p>
            </div>
            <span className="rounded-full bg-warn-bg px-3 py-1 text-xs text-warn">{statusFa(o.status)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {steps.filter((st) => canMove(o.status, st)).map((st) => <Btn key={st} tone="ghost" onClick={() => jump(o, st)}>{statusFa(st)}</Btn>)}
            {role === "manager" && o.status === "new" && /^\d+$/.test(o.id) ? <Btn tone="ghost" onClick={() => beginEdit(o)}>ویرایش سفارش</Btn> : null}
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
            <div className="flex gap-2">
              {(["cash", "card", "online"] as const).map((method) => <button key={method} type="button" onClick={() => setEditPayment(method)} className={`flex-1 rounded-xl border px-3 py-2 text-sm ${editPayment === method ? "bg-ink text-bg" : "border-line"}`}>{method === "cash" ? "نقد" : method === "card" ? "کارت" : "آنلاین"}</button>)}
            </div>
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
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 font-bold">دسته‌بندی</h2>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; const item = { id: uid("c"), name: name.trim() }; void saveCentralRecord("categories", item, () => saveCategory(item)).then((ok) => { if (ok) setName(""); }); }}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته" />
          <Btn type="submit">افزودن</Btn>
        </form>
        <p className="mt-2 text-sm text-muted">{categories.map((c) => c.name).join(" · ")}</p>
      </Card>
      <div className="flex justify-between"><h2 className="font-bold">محصولات</h2>
        <Btn onClick={() => setDraft({ id: uid("p"), name: "", categoryId: categories[0]?.id ?? "", price: 0, cost: 0, options: [], recipe: [], active: true })}>محصول جدید</Btn>
      </div>
      {products.map((p) => (
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
                <input className={`${inputCls} max-w-28`} type="number" value={line?.qty ?? 0} onChange={(e) => {
                  const qty = Number(e.target.value);
                  const recipe = draft.recipe.filter((r) => r.ingredientId !== ing.id);
                  setDraft({ ...draft, recipe: qty > 0 ? [...recipe, { ingredientId: ing.id, qty }] : recipe });
                }} />
              </label>
            );
          })}
          <div className="mt-3 flex gap-2"><Btn onClick={() => { if (draft.name) void saveCentralRecord("products", draft, () => saveProduct(draft)).then((ok) => { if (ok) setDraft(null); }); }}>ذخیره</Btn><Btn tone="ghost" onClick={() => setDraft(null)}>بستن</Btn></div>
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
  return (
    <div className="space-y-3">
      <h2 className="font-bold">انبار مواد اولیه</h2>
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
            <div className="flex gap-2">
              <Btn tone="ghost" onClick={() => { void adjustCentralStock<typeof i>(i.id, -1, (item) => saveIngredient(item)); }}>−۱</Btn>
              <Btn tone="ghost" onClick={() => { void adjustCentralStock<typeof i>(i.id, 1, (item) => saveIngredient(item)); }}>+۱</Btn>
              <Btn tone="leaf" onClick={() => { void adjustCentralStock<typeof i>(i.id, 10, (item) => saveIngredient(item)); }}>+۱۰</Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CustomersScreen() {
  const customers = usePos((s) => s.customers);
  const orders = usePos((s) => s.orders);
  const saveCustomer = usePos((s) => s.saveCustomer);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", birthday: "" });
  const list = customers.filter((c) => c.name.includes(q) || c.phone.includes(q));
  return (
    <div className="space-y-3">
      <h2 className="font-bold">باشگاه مشتریان</h2>
      <p className="text-sm text-muted">نقره از ۵۰۰ امتیاز (۳٪)، طلا از ۱۵۰۰ (۵٪)، پلاتین از ۴۰۰۰ (۸٪). هر ۱۰۰٬۰۰۰ تومان یک امتیاز.</p>
      <Card>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          if (!form.phone) return;
          const item = { id: uid("cu"), name: form.name || "بدون نام", phone: form.phone, points: 0, birthday: form.birthday, totalSpent: 0, visits: 0, createdAt: new Date().toISOString() };
          void saveCentralRecord("customers", item, () => saveCustomer(item)).then((ok) => { if (ok) setForm({ name: "", phone: "", birthday: "" }); });
        }}>
          <input className={inputCls} placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="موبایل" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={inputCls} type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
          <Btn type="submit">عضویت</Btn>
        </form>
      </Card>
      <input className={inputCls} placeholder="جستجو" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <div><p className="font-bold">{c.name}</p><p className="text-sm text-muted">{c.phone}</p></div>
            <p className="text-sm">{TIER_LABEL[tierOf(c.points)]} — {c.points.toLocaleString("fa-IR")} امتیاز — {money(c.totalSpent)}</p>
          </div>
          <p className="mt-1 text-xs text-muted">{orders.filter((o) => o.customerId === c.id).length.toLocaleString("fa-IR")} سفارش</p>
        </Card>
      ))}
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
      <div className="flex justify-between"><h2 className="font-bold">کدهای تخفیف</h2><Btn onClick={() => setDraft(emptyCode())}>کد جدید</Btn></div>
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

function ReportsScreen() {
  const orders = usePos((s) => s.orders);
  const expenses = usePos((s) => s.expenses);
  const products = usePos((s) => s.products);
  const addExpense = usePos((s) => s.addExpense);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [cat, setCat] = useState("مواد اولیه");
  const done = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);
  const sales = done.reduce((s, o) => s + o.total, 0);
  const costGuess = done.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + (products.find((x) => x.id === l.productId)?.cost ?? 0) * l.qty, 0), 0);
  const spend = expenses.reduce((s, e) => s + e.amount, 0);
  const days = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); map.set(d.toISOString().slice(0, 10), 0); }
    for (const o of done) { const k = o.createdAt.slice(0, 10); if (map.has(k)) map.set(k, (map.get(k) ?? 0) + o.total); }
    return [...map.entries()].map(([day, total]) => ({ day: new Date(day).toLocaleDateString("fa-IR", { weekday: "short" }), total }));
  }, [done]);
  const rank = new Map<string, number>();
  for (const o of done) for (const l of o.lines) rank.set(l.name, (rank.get(l.name) ?? 0) + l.qty);
  const top = [...rank.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <div className="space-y-4">
      <h2 className="font-bold">گزارش فروش و هزینه</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-muted">فروش</p><p className="text-xl font-bold">{money(sales)}</p></Card>
        <Card><p className="text-sm text-muted">بهای تمام‌شده</p><p className="text-xl font-bold">{money(costGuess)}</p></Card>
        <Card><p className="text-sm text-muted">سود پس از هزینه</p><p className="text-xl font-bold">{money(sales - costGuess - spend)}</p></Card>
      </div>
      <Card className="h-64">
        <p className="mb-2 text-sm text-muted">هفت روز اخیر</p>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={days}><XAxis dataKey="day" /><YAxis hide /><Tooltip formatter={(v) => money(Number(v ?? 0))} /><Bar dataKey="total" fill="#c2410c" radius={6} /></BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <p className="mb-2 font-semibold">پرفروش‌ها</p>
        {top.length === 0 ? <Empty text="بعد از چند فروش اینجا پر می‌شود" /> : top.map(([n, qty]) => <p key={n} className="flex justify-between text-sm"><span>{n}</span><span>{qty.toLocaleString("fa-IR")}</span></p>)}
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">ثبت هزینه</h3>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); if (!title || amount <= 0) return; const item = { id: uid("ex"), title, amount, category: cat, date: new Date().toISOString().slice(0, 10) }; void saveCentralRecord("expenses", item, () => addExpense(item)).then((ok) => { if (ok) { setTitle(""); setAmount(0); } }); }}>
          <input className={inputCls} placeholder="شرح" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inputCls} type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <input className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)} />
          <Btn type="submit">ثبت</Btn>
        </form>
        <ul className="mt-3 space-y-1 text-sm">{expenses.map((e) => <li key={e.id} className="flex justify-between"><span>{e.title}</span><span>{money(e.amount)}</span></li>)}</ul>
      </Card>
    </div>
  );
}

function SmsScreen() {
  const templates = usePos((s) => s.templates);
  const logs = usePos((s) => s.smsLogs);
  const saveTemplate = usePos((s) => s.saveTemplate);
  const customers = usePos((s) => s.customers);
  const [manual, setManual] = useState({ to: "", text: "" });
  return (
    <div className="space-y-4">
      <h2 className="font-bold">ملی‌پیامک</h2>
      <Card>
        <p className="text-sm">اعتبارنامهٔ ملی‌پیامک فقط در فایل خصوصی سرور (private/config.php) تنظیم می‌شود و در این صفحه یا مرورگر نگهداری نمی‌شود.</p>
        <p className="mt-2 text-xs text-muted">برای فعال‌سازی، مدیر سرور باید provider را روی national_payamak قرار دهد و نام کاربری، رمز/API Key و سرشماره را در تنظیمات خصوصی هاست وارد کند. برای آزمایش، ابتدا ارسال دستی را به شمارهٔ آزمایشی خود انجام دهید.</p>
      </Card>
      {templates.map((t) => (
        <Card key={t.event}>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={t.enabled} onChange={(e) => { const item = { ...t, enabled: e.target.checked }; void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item)); }} />
            {EVENT_LABEL[t.event]}
          </label>
          <textarea className={`${inputCls} mt-2`} rows={2} value={t.body} onChange={(e) => saveTemplate({ ...t, body: e.target.value })} onBlur={() => { const item = usePos.getState().templates.find((x) => x.event === t.event); if (item) void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item)); }} />
          <Field label="شناسه پترن (اختیاری)"><input className={inputCls} value={t.bodyId} onChange={(e) => saveTemplate({ ...t, bodyId: e.target.value })} onBlur={() => { const item = usePos.getState().templates.find((x) => x.event === t.event); if (item) void saveCentralRecord("templates", { ...item, id: item.event }, () => saveTemplate(item)); }} /></Field>
        </Card>
      ))}
      <Card>
        <h3 className="mb-2 font-semibold">ارسال دستی</h3>
        <div className="grid gap-2">
          <input className={inputCls} placeholder="شماره" value={manual.to} onChange={(e) => setManual({ ...manual, to: e.target.value })} />
          <textarea className={inputCls} rows={2} value={manual.text} onChange={(e) => setManual({ ...manual, text: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => void sendRaw(manual.to, manual.text)}>ارسال به یک شماره</Btn>
            <Btn tone="ghost" onClick={() => { for (const c of customers) void sendRaw(c.phone, manual.text); }}>ارسال به اعضای باشگاه</Btn>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">لاگ ارسال</h3>
        {logs.length === 0 ? <Empty text="ارسالی ثبت نشده" /> : logs.slice(0, 20).map((l) => (
          <p key={l.id} className="border-b border-line py-2 text-sm"><span className={l.ok ? "text-leaf" : "text-warn"}>{l.ok ? "موفق" : "ناموفق"}</span> — {l.to} — {l.detail}</p>
        ))}
      </Card>
    </div>
  );
}

type ServerOrder = {
  id: string;
  orderNumber: number;
  status: Order["status"];
  items: CartLine[];
  totals: Partial<Pick<Order, "subtotal" | "tierDiscount" | "codeDiscount" | "pointsDiscount" | "tax" | "total">>;
  created_at?: string;
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
    createdAt: order.created_at ?? new Date().toISOString(),
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
      <h2 className="font-bold">تنظیمات فروشگاه و فیش‌پرینتر</h2>
      <Card className="grid gap-2 sm:grid-cols-2">
        <Field label="نام فروشگاه"><input className={inputCls} value={settings.shopName} onChange={(e) => patchSettings({ shopName: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="تلفن"><input className={inputCls} value={settings.phone} onChange={(e) => patchSettings({ phone: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="آدرس"><input className={inputCls} value={settings.address} onChange={(e) => patchSettings({ address: e.target.value })} onBlur={persistSettings} /></Field>
        <Field label="مالیات درصد"><input className={inputCls} type="number" min="0" max="100" step="0.01" value={settings.taxPercent} onChange={(e) => patchSettings({ taxPercent: Number(e.target.value) })} onBlur={persistSettings} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.taxEnabled !== false} onChange={(e) => { const value = e.target.checked; patchSettings({ taxEnabled: value }); const current = usePos.getState().settings; void saveCentralRecord("settings", { id: "main", ...current, taxEnabled: value, smsUser: "", smsKey: "", smsFrom: "" }, () => {}); }} />محاسبه مالیات فعال باشد</label>
        <Field label="هر چند تومان یک امتیاز"><input className={inputCls} type="number" value={settings.pointsPerToman} onChange={(e) => patchSettings({ pointsPerToman: Number(e.target.value) })} onBlur={persistSettings} /></Field>
        <Field label="ارزش هر امتیاز"><input className={inputCls} type="number" value={settings.tomanPerPoint} onChange={(e) => patchSettings({ tomanPerPoint: Number(e.target.value) })} onBlur={persistSettings} /></Field>
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
