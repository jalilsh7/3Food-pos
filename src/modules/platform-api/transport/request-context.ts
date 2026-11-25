/** Request correlation helpers. IDs contain no user or business data. */
export function createRequestCorrelationId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ??
      `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Strip query strings before diagnostics so request parameters are not exposed. */
export function safeApiAction(path: string): string {
  const clean = path.split("?")[0].split("#")[0];
  return clean.slice(0, 160);
}
