/**
 * Same-origin client for the PHP/MySQL backend.
 *
 * Session authentication is cookie-based (HttpOnly); CSRF is held in memory
 * only and refreshed from login / auth-me responses. Never persist passwords,
 * session identifiers, CSRF tokens, or API secrets in localStorage.
 *
 * This module is an integration foundation. The current POS store and auth UI
 * are not switched to it until their state and error handling are migrated.
 */

export type PosRole = "manager" | "cashier" | "kitchen";

export type ApiUser = {
  id: number;
  username: string;
  display_name: string;
  role: PosRole;
  must_change_password?: boolean;
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
    if (response.status === 401) csrfToken = null;
    const code = typeof payload.error === "string" ? payload.error : "request_failed";
    const message = typeof payload.message === "string" ? payload.message : "درخواست انجام نشد.";
    throw new PhpApiError(response.status, code, message);
  }

  return payload as T;
}

export const phpApi = {
  health: () => request<ApiEnvelope<{ service?: string; database?: string }>>("/health"),

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

  saveRecord: <TItem extends { id: string | number }>(resource: string, item: TItem) =>
    request<ApiEnvelope<{ item: TItem }>>(`/records/${encodeURIComponent(resource)}`, {
      method: "POST",
      csrf: true,
      body: { item },
    }),

  deleteRecord: (resource: string, id: string) =>
    request<ApiEnvelope<Record<string, never>>>(
      `/records/${encodeURIComponent(resource)}?id=${encodeURIComponent(id)}`,
      { method: "DELETE", csrf: true },
    ),

  createOrder: <TOrder>(input: {
    items: unknown[];
    totals: Record<string, number>;
    customer?: unknown;
    note?: string;
  }) =>
    request<ApiEnvelope<{ order: TOrder }>>("/orders", {
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
