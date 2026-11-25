import { usePos } from "@/lib/pos/store";
import type { CartLine, Order, PosState, Role, Settings, SmsLog } from "@/lib/pos/model";

export type ExpenseCategory = { id: string; name: string; active?: boolean };

type ServerOrder = {
  id: string;
  orderNumber: number;
  status: Order["status"];
  items: CartLine[];
  totals?: Partial<Pick<Order, "subtotal" | "tierDiscount" | "codeDiscount" | "pointsDiscount" | "tax" | "total">>;
  created_at?: string;
  createdAt?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  payment?: Order["payment"];
  pointsUsed?: number;
  pointsEarned?: number;
  discountCode?: string | null;
  note?: string | null;
};

export type ServerBootstrap = Partial<Omit<PosState, "orders" | "settings">> & {
  orders?: ServerOrder[];
  sms_logs?: SmsLog[];
  settings?: Array<Partial<Settings> & { id?: string }>;
};

const EMPTY_ROLE_SETTINGS = {
  shopName: "",
  defaultCustomerLabel: "مشتری عزیز",
  address: "",
  phone: "",
  taxPercent: 0,
  taxEnabled: true,
  stockPolicy: "warn_and_allow" as const,
  orderDelayMinutes: 20,
  pointsPerToman: 100000,
  tomanPerPoint: 1000,
  paperWidth: 80 as const,
  autoPrint: false,
  printCustomer: false,
  printKitchen: true,
  headerNote: "",
  footerNote: "",
  smsUser: "",
  smsKey: "",
  smsFrom: "",
  role: "manager" as Role,
};

export function resetPosForRole(role: Role) {
  usePos.setState({
    categories: [],
    products: [],
    ingredients: [],
    customers: [],
    discounts: [],
    orders: [],
    expenses: [],
    templates: [],
    smsLogs: [],
    settings: { ...EMPTY_ROLE_SETTINGS, role },
    nextOrder: 1,
  });
}

export function readLegacyBrowserPosState(): Partial<PosState> | null {
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

export function hydratePosFromServer(data: ServerBootstrap, nextOrder: number, role: Role) {
  const current = usePos.getState();
  const serverSettings = data.settings?.[0];
  const products = (data.products ?? []).map((product) => ({
    ...product,
    options: Array.isArray(product.options) ? product.options : [],
    recipe: Array.isArray(product.recipe) ? product.recipe : [],
    active: product.active !== false,
  }));
  const ingredients = (data.ingredients ?? []).map((ingredient) => ({
    ...ingredient,
    minStock: Number.isFinite(Number(ingredient.minStock)) ? Math.max(0, Number(ingredient.minStock)) : 5,
  }));
  const orders: Order[] = (data.orders ?? []).map((order) => ({
    id: String(order.id),
    number: Number(order.orderNumber),
    createdAt: order.createdAt ?? order.created_at ?? new Date().toISOString(),
    status: order.status,
    lines: Array.isArray(order.items) ? order.items.map((line, index) => ({
      ...line,
      key: line.key || `legacy-${order.id}-${index}`,
      name: line.name || "محصول",
      productId: line.productId || "",
      qty: Number.isFinite(Number(line.qty)) && Number(line.qty) > 0 ? Math.floor(Number(line.qty)) : 1,
      unitPrice: Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice) : 0,
      optionIds: Array.isArray(line.optionIds) ? line.optionIds.map(String) : [],
      optionLabels: Array.isArray(line.optionLabels) ? line.optionLabels.map(String) : [],
      note: line.note ?? "",
    })) : [],
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
    note: order.note ?? "",
    pointsUsed: Number(order.pointsUsed ?? 0),
    pointsEarned: Number(order.pointsEarned ?? 0),
  }));

  // Bootstrap is a complete snapshot for the authenticated role. Missing
  // collections are intentionally cleared (e.g. kitchen must not retain
  // manager-only records from a previous in-memory session).
  usePos.setState({
    categories: data.categories ?? [],
    products,
    ingredients,
    customers: data.customers ?? [],
    discounts: data.discounts ?? [],
    expenses: data.expenses ?? [],
    templates: data.templates ?? [],
    smsLogs: data.sms_logs ?? [],
    orders,
    settings: {
      ...current.settings,
      ...(serverSettings ?? {}),
      taxPercent: Math.min(100, Math.max(0, Number(serverSettings?.taxPercent ?? current.settings.taxPercent) || 0)),
      pointsPerToman: Math.max(1, Math.floor(Number(serverSettings?.pointsPerToman ?? current.settings.pointsPerToman) || 1)),
      tomanPerPoint: Math.max(1, Math.floor(Number(serverSettings?.tomanPerPoint ?? current.settings.tomanPerPoint) || 1)),
      smsUser: "",
      smsKey: "",
      smsFrom: "",
      role,
    },
    nextOrder: Math.max(nextOrder, 1),
  });
  return true;
}
