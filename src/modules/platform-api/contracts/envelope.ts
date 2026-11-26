/** Stable API response/error contracts shared by feature adapters. */
export type ApiEnvelope<T> = { ok: true } & T;
export type ApiFailureEnvelope = { ok?: false; error?: string; message?: string };

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  csrf?: boolean;
  setupToken?: string;
};

export type ApiDiagnosticContext = {
  correlationId: string;
  module: string;
  action: string;
  status?: number;
  code?: string;
};
