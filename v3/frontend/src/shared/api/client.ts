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

function setCsrfToken(token: unknown): void {
  csrfToken = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
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
  const data = await request<{ user: AuthenticatedUser; csrf_token: string }>("/auth/me");
  setCsrfToken(data.csrf_token);
  return data.user;
}

export async function signIn(username: string, password: string): Promise<AuthenticatedUser> {
  const data = await request<{ user: AuthenticatedUser; csrf_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setCsrfToken(data.csrf_token);
  return data.user;
}

export async function signOut(): Promise<void> {
  await request<{ logged_out: boolean }>("/auth/logout", { method: "POST", body: "{}" });
  setCsrfToken(null);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request<{ password_changed: boolean }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  setCsrfToken(null);
}
