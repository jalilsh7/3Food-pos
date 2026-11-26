/** Security policy constants for same-origin PHP API calls. */
export const phpTransportPolicy = Object.freeze({
  root: "/api/v1",
  credentials: "same-origin" as RequestCredentials,
  cache: "no-store" as RequestCache,
  accept: "application/json",
  csrfHeader: "X-CSRF-Token",
  correlationHeader: "X-Correlation-ID",
  setupHeader: "X-Setup-Token",
});
