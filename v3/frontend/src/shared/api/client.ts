export type BusinessSummary = { id: string; code: string; name: string; timezone: string; currency: string };
export type BranchSummary = { id: string; code: string; name: string; timezone: string | null; is_active: boolean };
export type SavedBusinessContext = { businessId: string; branchId: string };

export type AuthenticatedUser = {
  id: string;
  username: string;
  display_name: string;
  must_change_password: boolean;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "ApiError";
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");
let csrfToken: string | null = null;
let businessContext: { businessId: string; branchId: string } | null = null;
const contextStorageKey = "pos_v3_business_context";

export function getSavedBusinessContext(): SavedBusinessContext | null {
  try {
    const raw = window.localStorage.getItem(contextStorageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedBusinessContext>;
    if (typeof value.businessId !== "string" || typeof value.branchId !== "string"
      || !/^[0-9a-f-]{36}$/i.test(value.businessId) || !/^[0-9a-f-]{36}$/i.test(value.branchId)) return null;
    return { businessId: value.businessId, branchId: value.branchId };
  } catch {
    return null;
  }
}

export function setBusinessContext(business: BusinessSummary, branch: BranchSummary): void {
  businessContext = { businessId: business.id, branchId: branch.id };
  try {
    window.localStorage.setItem(contextStorageKey, JSON.stringify(businessContext));
  } catch {
    // Public context identifiers are a convenience only; the active in-memory context remains usable.
  }
}

export function clearBusinessContext(): void {
  businessContext = null;
  try {
    window.localStorage.removeItem(contextStorageKey);
  } catch {
    // Storage may be unavailable; the in-memory context is still cleared.
  }
}

function setCsrfToken(token: unknown): void {
  csrfToken = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

async function request<T>(path: string, options: RequestInit = {}, context: { businessId: string; branchId: string | null } | null | undefined = undefined): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  const scope = context === undefined ? businessContext : context;
  if (scope?.businessId && !headers.has("X-Business-ID")) headers.set("X-Business-ID", scope.businessId);
  if (scope?.branchId && !headers.has("X-Branch-ID")) headers.set("X-Branch-ID", scope.branchId);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("ارتباط با سرور برقرار نشد. اتصال شبکه و نشانی API را بررسی کنید.", 0, "network_error");
  }

  const payload = await response.json().catch(() => null) as
    | { data?: T; error?: { message?: string; code?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw new ApiError(
      payload?.error?.message || "درخواست انجام نشد. دوباره تلاش کنید.",
      response.status,
      payload?.error?.code || "request_failed",
    );
  }
  return payload.data as T;
}

export async function getCurrentSession(): Promise<AuthenticatedUser> {
  const data = await request<{ user: AuthenticatedUser; csrf_token: string }>("/auth/me", {}, null);
  setCsrfToken(data.csrf_token);
  return data.user;
}

export async function signIn(username: string, password: string): Promise<AuthenticatedUser> {
  const data = await request<{ user: AuthenticatedUser; csrf_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }, null);
  setCsrfToken(data.csrf_token);
  return data.user;
}

export async function signOut(): Promise<void> {
  await request<{ logged_out: boolean }>("/auth/logout", { method: "POST", body: "{}" }, null);
  setCsrfToken(null);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request<{ password_changed: boolean }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }, null);
  setCsrfToken(null);
}

 
export async function getAccessibleBusinesses(): Promise<{ businesses: BusinessSummary[]; can_initialize: boolean }> {
  return request<{ businesses: BusinessSummary[]; can_initialize: boolean }>("/access/businesses", {}, null);
}

export async function getBranches(businessId: string): Promise<BranchSummary[]> {
  const data = await request<{ branches: BranchSummary[] }>("/access/branches", {}, { businessId, branchId: null });
  return data.branches.filter((branch) => branch.is_active);
}

export async function createInitialBusiness(payload: {
  name: string;
  code: string;
  timezone: string;
  currency: "IRT";
  branch_name: string;
  branch_code: string;
}): Promise<{ business: BusinessSummary; branch: BranchSummary; setup_completed: boolean }> {
  return request<{ business: BusinessSummary; branch: BranchSummary; setup_completed: boolean }>(
    "/setup/business",
    { method: "POST", body: JSON.stringify(payload) },
    null,
  );
}
