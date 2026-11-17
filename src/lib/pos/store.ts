import { create } from "zustand";
import {
  customerCodeUses,
  quoteOrder,
  tierOf,
  uid,
  type CartLine,
  type Category,
  type Customer,
  type DiscountCode,
  type Expense,
  type Ingredient,
  type Order,
  type OrderStatus,
  type PosState,
  type Product,
  type Role,
  type Settings,
  type SmsLog,
  type SmsTemplate,
} from "./model";

const templates: SmsTemplate[] = [
  {
    event: "order_created",
    enabled: true,
    body: "{name} عزیز، سفارش {order} به مبلغ {total} ثبت شد. {shop}",
    bodyId: "",
  },
  {
    event: "order_ready",
    enabled: true,
    body: "{name} عزیز، سفارش {order} آماده تحویل است. {shop}",
    bodyId: "",
  },
  {
    event: "order_delivered",
    enabled: false,
    body: "{name} عزیز، سفارش {order} تحویل شد. ممنون از خرید شما. {shop}",
    bodyId: "",
  },
  {
    event: "points_earned",
    enabled: true,
    body: "{name} عزیز، {points} امتیاز به باشگاه شما اضافه شد. موجودی: {balance}. {shop}",
    bodyId: "",
  },
  {
    event: "discount_used",
    enabled: false,
    body: "کد {code} روی سفارش {order} اعمال شد. {shop}",
    bodyId: "",
  },
];

function seed(): PosState {
  const categories: Category[] = [
    { id: "c1", name: "برگر" },
    { id: "c2", name: "پیتزا" },
    { id: "c3", name: "ساندویچ" },
    { id: "c4", name: "سیب‌زمینی" },
    { id: "c5", name: "نوشیدنی" },
  ];
  const ingredients: Ingredient[] = [
    { id: "i1", name: "نان برگر", unit: "عدد", stock: 80, minStock: 20, costPerUnit: 8000 },
    { id: "i2", name: "گوشت برگر", unit: "عدد", stock: 60, minStock: 15, costPerUnit: 55000 },
    { id: "i3", name: "پنیر ورقه‌ای", unit: "ورق", stock: 40, minStock: 12, costPerUnit: 12000 },
    { id: "i4", name: "خمیر پیتزا", unit: "عدد", stock: 30, minStock: 8, costPerUnit: 25000 },
    { id: "i5", name: "مرغ گریل", unit: "گرم", stock: 8000, minStock: 1500, costPerUnit: 280 },
    { id: "i6", name: "سیب‌زمینی", unit: "گرم", stock: 12000, minStock: 2000, costPerUnit: 40 },
    { id: "i7", name: "روغن", unit: "میلی‌لیتر", stock: 5000, minStock: 800, costPerUnit: 90 },
    { id: "i8", name: "نوشابه", unit: "عدد", stock: 48, minStock: 12, costPerUnit: 18000 },
  ];
  const cheese: Product["options"][number] = { id: "o1", name: "پنیر اضافه", price: 25000 };
  const spicy: Product["options"][number] = { id: "o2", name: "سس تند", price: 0 };
  const products: Product[] = [
    {
      id: "p1",
      name: "همبرگر ویژه",
      categoryId: "c1",
      price: 185000,
      cost: 90000,
      active: true,
      options: [cheese, spicy],
      recipe: [
        { ingredientId: "i1", qty: 1 },
        { ingredientId: "i2", qty: 1 },
      ],
    },
    {
      id: "p2",
      name: "چیزبرگر",
      categoryId: "c1",
      price: 215000,
      cost: 110000,
      active: true,
      options: [spicy],
      recipe: [
        { ingredientId: "i1", qty: 1 },
        { ingredientId: "i2", qty: 1 },
        { ingredientId: "i3", qty: 1 },
      ],
    },
    {
      id: "p3",
      name: "پیتزا مخلوط",
      categoryId: "c2",
      price: 340000,
      cost: 150000,
      active: true,
      options: [{ id: "o3", name: "لبه پنیری", price: 40000 }],
      recipe: [
        { ingredientId: "i4", qty: 1 },
        { ingredientId: "i3", qty: 2 },
      ],
    },
    {
      id: "p4",
      name: "ساندویچ مرغ",
      categoryId: "c3",
      price: 175000,
      cost: 80000,
      active: true,
      options: [spicy],
      recipe: [
        { ingredientId: "i1", qty: 1 },
        { ingredientId: "i5", qty: 120 },
      ],
    },
    {
      id: "p5",
      name: "سیب‌زمینی ویژه",
      categoryId: "c4",
      price: 89000,
      cost: 28000,
      active: true,
      options: [{ id: "o4", name: "سایز بزرگ", price: 25000 }],
      recipe: [
        { ingredientId: "i6", qty: 200 },
        { ingredientId: "i7", qty: 30 },
      ],
    },
    {
      id: "p6",
      name: "نوشابه خانواده",
      categoryId: "c5",
      price: 45000,
      cost: 18000,
      active: true,
      options: [],
      recipe: [{ ingredientId: "i8", qty: 1 }],
    },
  ];
  const customers: Customer[] = [
    {
      id: "u1",
      name: "سارا محمدی",
      phone: "09120001111",
      points: 620,
      birthday: "1996-05-12",
      totalSpent: 2400000,
      visits: 8,
      createdAt: new Date().toISOString(),
    },
    {
      id: "u2",
      name: "علی رضایی",
      phone: "09123334455",
      points: 180,
      birthday: "",
      totalSpent: 640000,
      visits: 3,
      createdAt: new Date().toISOString(),
    },
  ];
  const discounts: DiscountCode[] = [
    {
      id: "d1",
      code: "WELCOME",
      type: "percent",
      value: 10,
      maxDiscount: 80000,
      minOrder: 150000,
      maxUses: 100,
      usedCount: 4,
      perCustomer: 1,
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
      audience: "all",
    },
    {
      id: "d2",
      code: "GOLD20",
      type: "fixed",
      value: 50000,
      maxDiscount: 0,
      minOrder: 200000,
      maxUses: 0,
      usedCount: 0,
      perCustomer: 3,
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
      audience: "gold",
    },
  ];
  const settings: Settings = {
    shopName: "گریل‌کَش",
    address: "تهران، خیابان ولیعصر، پلاک ۴۲",
    phone: "021-88000000",
    taxPercent: 0,
    taxEnabled: true,
    pointsPerToman: 100000,
    tomanPerPoint: 1000,
    paperWidth: 80,
    autoPrint: false,
    printCustomer: true,
    printKitchen: true,
    headerNote: "به گریل‌کَش خوش آمدید",
    footerNote: "با تشکر از انتخاب شما",
    smsUser: "",
    smsKey: "",
    smsFrom: "",
    role: "manager",
  };
  return {
    // Business records are loaded from MySQL after authentication. Start with
    // empty collections so demo/legacy browser data can never act as authority.
    categories: [],
    products: [],
    ingredients: [],
    customers: [],
    discounts: [],
    orders: [],
    expenses: [],
    templates: [],
    smsLogs: [],
    settings,
    nextOrder: 1,
  };
}

type Actions = {
  setRole: (role: Role) => void;
  patchSettings: (p: Partial<Settings>) => void;
  saveCategory: (c: Category) => void;
  removeCategory: (id: string) => void;
  saveProduct: (p: Product) => void;
  removeProduct: (id: string) => void;
  saveIngredient: (i: Ingredient) => void;
  adjustStock: (id: string, delta: number) => void;
  saveCustomer: (c: Customer) => void;
  saveDiscount: (d: DiscountCode) => void;
  removeDiscount: (id: string) => void;
  addExpense: (e: Omit<Expense, "id"> & { id?: string }) => void;
  removeExpense: (id: string) => void;
  saveTemplate: (t: SmsTemplate) => void;
  placeOrder: (input: {
    lines: CartLine[];
    customer: Customer | null;
    code: string;
    pointsToUse: number;
    payment: Order["payment"];
    guestName: string;
    guestPhone: string;
    serverOrder?: { id: string; number: number };
  }) => { ok: true; order: Order } | { ok: false; error: string };
  setStatus: (id: string, status: OrderStatus) => Order | null;
  logSms: (log: Omit<SmsLog, "id" | "at">) => void;
  exportBackup: () => string;
  importBackup: (json: string) => string;
  resetDemo: () => void;
};

export const usePos = create<PosState & Actions>()(
    (set, get) => ({
      ...seed(),
      setRole: (role) => set((s) => ({ settings: { ...s.settings, role } })),
      patchSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p, role: s.settings.role } })),
      saveCategory: (c) =>
        set((s) => ({
          categories: s.categories.some((x) => x.id === c.id)
            ? s.categories.map((x) => (x.id === c.id ? c : x))
            : [...s.categories, c],
        })),
      removeCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),
      saveProduct: (p) =>
        set((s) => ({
          products: s.products.some((x) => x.id === p.id)
            ? s.products.map((x) => (x.id === p.id ? p : x))
            : [...s.products, p],
        })),
      removeProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      saveIngredient: (i) =>
        set((s) => ({
          ingredients: s.ingredients.some((x) => x.id === i.id)
            ? s.ingredients.map((x) => (x.id === i.id ? i : x))
            : [...s.ingredients, i],
        })),
      adjustStock: (id, delta) =>
        set((s) => ({
          ingredients: s.ingredients.map((i) =>
            i.id === id ? { ...i, stock: Math.max(0, i.stock + delta) } : i,
          ),
        })),
      saveCustomer: (c) =>
        set((s) => ({
          customers: s.customers.some((x) => x.id === c.id)
            ? s.customers.map((x) => (x.id === c.id ? c : x))
            : [...s.customers, c],
        })),
      saveDiscount: (d) =>
        set((s) => ({
          discounts: s.discounts.some((x) => x.id === d.id)
            ? s.discounts.map((x) => (x.id === d.id ? d : x))
            : [...s.discounts, { ...d, code: d.code.toUpperCase() }],
        })),
      removeDiscount: (id) => set((s) => ({ discounts: s.discounts.filter((d) => d.id !== id) })),
      addExpense: (e) => set((s) => ({ expenses: [{ ...e, id: e.id ?? uid("ex") }, ...s.expenses] })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
      saveTemplate: (t) =>
        set((s) => ({ templates: s.templates.map((x) => (x.event === t.event ? t : x)) })),
      placeOrder: (input) => {
        const s = get();
        if (!input.lines.length) return { ok: false, error: "سبد خالی است" };
        const uses =
          input.customer && input.code
            ? customerCodeUses(s.orders, input.customer.id, input.code)
            : 0;
        const q = quoteOrder({
          lines: input.lines,
          customer: input.customer,
          code: input.code,
          discounts: s.discounts,
          pointsToUse: input.pointsToUse,
          taxPercent: s.settings.taxPercent,
          tomanPerPoint: s.settings.tomanPerPoint,
          usesSoFar: uses,
        });
        if (input.code && q.codeError) return { ok: false, error: q.codeError };
        if (input.pointsToUse > 0 && q.pointsError) return { ok: false, error: q.pointsError };
        const phone = input.customer?.phone || input.guestPhone;
        const name = input.customer?.name || input.guestName || "مشتری";
        let customerId = input.customer?.id ?? null;
        let customers = s.customers;
        if (!customerId && phone) {
          const existing = customers.find((c) => c.phone === phone);
          if (existing) customerId = existing.id;
          else {
            const created: Customer = {
              id: uid("cu"),
              name,
              phone,
              points: 0,
              birthday: "",
              totalSpent: 0,
              visits: 0,
              createdAt: new Date().toISOString(),
            };
            customers = [created, ...customers];
            customerId = created.id;
          }
        }
        const earned = customerId ? Math.floor(q.total / s.settings.pointsPerToman) : 0;
        const spentPts = q.pointsDiscount > 0 ? Math.ceil(q.pointsDiscount / s.settings.tomanPerPoint) : 0;
        const order: Order = {
          id: input.serverOrder?.id ?? uid("or"),
          number: input.serverOrder?.number ?? s.nextOrder,
          createdAt: new Date().toISOString(),
          status: "new",
          lines: input.lines,
          subtotal: q.subtotal,
          tierDiscount: q.tierDiscount,
          codeDiscount: q.codeDiscount,
          pointsDiscount: q.pointsDiscount,
          tax: q.tax,
          total: q.total,
          payment: input.payment,
          customerId,
          customerName: name,
          customerPhone: phone,
          discountCode: q.discount?.code ?? "",
          pointsUsed: spentPts,
          pointsEarned: earned,
        };
        const ingredients = s.ingredients.map((ing) => {
          let need = 0;
          for (const line of input.lines) {
            const product = s.products.find((p) => p.id === line.productId);
            const rec = product?.recipe.find((r) => r.ingredientId === ing.id);
            if (rec) need += rec.qty * line.qty;
            if (line.optionLabels.some((l) => l.includes("پنیر")) && ing.id === "i3") need += line.qty;
          }
          return { ...ing, stock: Math.max(0, +(ing.stock - need).toFixed(2)) };
        });
        customers = customers.map((c) =>
          c.id === customerId
            ? {
                ...c,
                name: c.name || name,
                points: Math.max(0, c.points - spentPts + earned),
                totalSpent: c.totalSpent + q.total,
                visits: c.visits + 1,
              }
            : c,
        );
        const discounts = s.discounts.map((d) =>
          q.discount && d.id === q.discount.id ? { ...d, usedCount: d.usedCount + 1 } : d,
        );
        set({
          orders: [order, ...s.orders],
          nextOrder: Math.max(s.nextOrder + 1, order.number + 1),
          ingredients,
          customers,
          discounts,
        });
        return { ok: true, order };
      },
      setStatus: (id, status) => {
        const prev = get().orders.find((o) => o.id === id) ?? null;
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        }));
        return prev ? { ...prev, status } : null;
      },
      logSms: (log) =>
        set((s) => ({
          smsLogs: [{ ...log, id: uid("sm"), at: new Date().toISOString() }, ...s.smsLogs].slice(0, 200),
        })),
      exportBackup: () => {
        const s = get();
        const data: PosState = {
          categories: s.categories,
          products: s.products,
          ingredients: s.ingredients,
          customers: s.customers,
          discounts: s.discounts,
          orders: s.orders,
          expenses: s.expenses,
          templates: s.templates,
          smsLogs: s.smsLogs,
          settings: { ...s.settings, smsUser: "", smsKey: "", smsFrom: "" },
          nextOrder: s.nextOrder,
        };
        return JSON.stringify(data);
      },
      importBackup: (json) => {
        try {
          const data = JSON.parse(json) as PosState;
          if (!data.products || !data.settings) return "فایل نامعتبر است";
          set({ ...data, settings: { ...data.settings, smsKey: get().settings.smsKey } });
          return "";
        } catch {
          return "خواندن فایل ممکن نشد";
        }
      },
      resetDemo: () => set(seed()),
    }),
);

export function lowStock(list: Ingredient[]) {
  return list.filter((i) => i.stock <= i.minStock);
}

export { tierOf };
