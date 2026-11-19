/**
 * Same-origin client for the PHP/MySQL backend.
 *
 * Session authentication is cookie-based (HttpOnly); CSRF is held in memory
 * only and refreshed from login / auth-me responses. Never persist passwords,
 * session identifiers, CSRF tokens, or API secrets in localStorage.
 *
 * The POS UI uses this client for PHP session auth, MySQL bootstrap, records,
 * orders, SMS, and backup operations. CSRF remains in memory only.
 */

export type PosRole = "manager" | "cashier" | "kitchen";

export type ApiUser = {
  id: number;
  username: string;
  display_name: string;
  role: PosRole;
  must_change_password?: boolean;
};

export type AppearanceSettings={appTitle:string;primary:string;secondary:string;mode:"light"|"dark";fontFamily:"byekan";fontSize:number;cardRadius:number;buttonRadius:number;logoUrl:string|null};
export type ManagedUser = ApiUser & {
  is_active: number | boolean;
  last_login_at?: string | null;
  created_at?: string;
};

export type ApiEnvelope<T> = {
  ok: true;
} & T;

export class PhpApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PhpApiError";
    this.status = status;
    this.code = code;
  }
}

const API_ROOT = "/api/v1";
let csrfToken: string | null = null;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  csrf?: boolean;
  setupToken?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.csrf) {
    if (!csrfToken) throw new PhpApiError(419, "csrf_missing", "نشست امنیتی آماده نیست؛ دوباره وارد شوید.");
    headers.set("X-CSRF-Token", csrfToken);
  }
  if (options.setupToken) headers.set("X-Setup-Token", options.setupToken);

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new PhpApiError(0, "network_error", "ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new PhpApiError(response.status, "invalid_response", "پاسخ سرور قابل خواندن نیست.");
  }

  if (!response.ok || payload.ok !== true) {
    const code = typeof payload.error === "string" ? payload.error : "request_failed";
    // A bad current password is a field-level 401, not an expired session.
    // Keep CSRF state unless the server explicitly says the session is unauthorized.
    if (response.status === 401 && code === "unauthorized") csrfToken = null;
    const message = typeof payload.message === "string" ? payload.message : "درخواست انجام نشد.";
    throw new PhpApiError(response.status, code, message);
  }

  return payload as T;
}

export const phpApi = {
  health: () => request<ApiEnvelope<{ service?: string; database?: string }>>("/health"),
  getAppearance:()=>request<ApiEnvelope<{settings:AppearanceSettings}>>("/appearance"),
  saveAppearance:(settings:AppearanceSettings)=>request<ApiEnvelope<{settings:AppearanceSettings}>>("/appearance",{method:"POST",csrf:true,body:{settings}}),
  resetAppearance:()=>request<ApiEnvelope<{settings:AppearanceSettings}>>("/appearance/reset",{method:"POST",csrf:true,body:{}}),
  uploadAppearanceLogo:(image:string)=>request<ApiEnvelope<{logo_url:string}>>("/appearance/logo",{method:"POST",csrf:true,body:{image}}),

  setupStatus: () =>
    request<ApiEnvelope<{ setup_required: boolean }>>("/setup/status"),

  setupManager: (input: {
    username: string;
    password: string;
    display_name: string;
    setupToken: string;
  }) =>
    request<ApiEnvelope<{ user: ApiUser; csrf_token: string }>>("/setup/manager", {
      method: "POST",
      setupToken: input.setupToken,
      body: {
        username: input.username,
        password: input.password,
        display_name: input.display_name,
      },
    }).then((result) => {
      csrfToken = result.csrf_token;
      return result;
    }),

  login: (username: string, password: string) =>
    request<ApiEnvelope<{ user: ApiUser; csrf_token: string }>>("/auth/login", {
      method: "POST",
      body: { username, password },
    }).then((result) => {
      csrfToken = result.csrf_token;
      return result;
    }),

  me: () =>
    request<
      ApiEnvelope<{
        authenticated: boolean;
        user?: ApiUser;
        csrf_token?: string;
      }>
    >("/auth/me").then((result) => {
      csrfToken = result.authenticated ? (result.csrf_token ?? null) : null;
      if (result.authenticated && result.user) {
        const flag = result.user.must_change_password as unknown;
        result.user.must_change_password = flag === true || flag === 1 || flag === "1";
      }
      return result;
    }),

  logout: () =>
    request<ApiEnvelope<Record<string, never>>>("/auth/logout", {
      method: "POST",
      csrf: true,
    }).finally(() => {
      csrfToken = null;
    }),

  changePassword: (current_password: string, new_password: string) =>
    request<ApiEnvelope<{ csrf_token: string }>>("/auth/change-password", {
      method: "POST",
      csrf: true,
      body: { current_password, new_password },
    }).then((result) => {
      csrfToken = result.csrf_token;
      return result;
    }),

  listUsers: () => request<ApiEnvelope<{ users: ManagedUser[] }>>("/users"),

  getReportSummary: (from: string, to: string) => request<ApiEnvelope<Record<string, unknown>>>(`/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  createUser: (input: { username: string; password: string; display_name: string; role: PosRole }) =>
    request<ApiEnvelope<{ user: ManagedUser }>>("/users", { method: "POST", csrf: true, body: input }),

  updateUser: (id: number, input: Partial<Pick<ManagedUser, "display_name" | "role" | "is_active">> & { password?: string }) =>
    request<ApiEnvelope<Record<string, never>>>(`/users/${id}`, { method: "PATCH", csrf: true, body: input }),

  exportBackup: () =>
    request<ApiEnvelope<{ backup: Record<string, unknown> }>>("/backup/export"),
  restoreBackup: (backup: Record<string, unknown>) =>
    request<ApiEnvelope<{ restored: { records: number; orders: number; effects: number; redemptions: number } }>>("/backup/restore", { method: "POST", body: { backup } }),

  importLegacyData: (input: {
    data: Record<string, unknown[]>;
    nextOrder: number;
  }) =>
    request<ApiEnvelope<{ counts: Record<string, number>; orders_imported: number }>>("/migration/import", {
      method: "POST",
      csrf: true,
      body: input,
    }),

  bootstrap: <TData>() =>
    request<
      ApiEnvelope<{
        data: TData;
        next_order: number;
        user: ApiUser;
      }>
    >("/bootstrap"),

  listRecords: <TItem>(resource: string) =>
    request<ApiEnvelope<{ items: TItem[] }>>(`/records/${encodeURIComponent(resource)}`),

  createSupplierTransaction: <TItem, TSupplier>(supplierId: string, item: TItem) => request<ApiEnvelope<{item:TItem;supplier:TSupplier}>>(`/suppliers/${encodeURIComponent(supplierId)}/purchases`, { method: "POST", csrf: true, body: { item } }),

  saveRecord: <TItem extends { id: string | number }>(resource: string, item: TItem) =>
    request<ApiEnvelope<{ item: TItem }>>(`/records/${encodeURIComponent(resource)}`, {
      method: "POST",
      csrf: true,
      body: { item },
    }),

  adjustIngredientStock: <TItem extends { id: string }>(id: string, delta: number) =>
    request<ApiEnvelope<{ item: TItem }>>(
      `/ingredients/${encodeURIComponent(id)}/stock`,
      { method: "POST", csrf: true, body: { delta } },
    ),

  deleteRecord: (resource: string, id: string) =>
    request<ApiEnvelope<Record<string, never>>>(
      `/records/${encodeURIComponent(resource)}?id=${encodeURIComponent(id)}`,
      { method: "DELETE", csrf: true },
    ),

  createOrder: <TOrder>(input: {
    items: unknown[];
    totals: Record<string, number>;
    customer?: unknown;
    discountCode?: string;
    note?: string;
    guestName?: string;
    guestPhone?: string;
    payment?: "cash" | "card" | "online";
    idempotencyKey: string;
  }) =>
    request<ApiEnvelope<{ order: TOrder; replayed?: boolean }>>("/orders", {
      method: "POST",
      csrf: true,
      body: input,
    }),

  sendSms: (input: { to: string; text: string; bodyId?: string }) =>
    request<ApiEnvelope<{ sent: boolean; detail: string }>>("/sms/send", {
      method: "POST",
      csrf: true,
      body: input,
    }),

  syncBirthdaySmsInbox: () =>
    request<ApiEnvelope<{ received: number; processed: number; duplicates: number; birthdays_saved: number; unmatched: number; ignored: number }>>("/sms/birthday-sync", {
      method: "POST",
      csrf: true,
      body: {},
    }),

  updateOrder: <TOrder>(id: string, input: {
    items: unknown[];
    totals: Record<string, number>;
    customer?: { id: string };
    discountCode?: string;
    note?: string;
    guestName?: string;
    guestPhone?: string;
    payment?: "cash" | "card" | "online";
  }) =>
    request<ApiEnvelope<{ order: TOrder }>>(`/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      csrf: true,
      body: input,
    }),

  setOrderStatus: (id: string, status: string) =>
    request<ApiEnvelope<{ status: string }>>(
      `/orders/${encodeURIComponent(id)}/status`,
      { method: "PATCH", csrf: true, body: { status } },
    ),
};

/** Clear in-memory CSRF state after an unrecoverable session transition. */
export function clearPhpApiSession(): void {
  csrfToken = null;
}
