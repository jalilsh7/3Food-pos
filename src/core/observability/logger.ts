import type { DiagnosticContext, DiagnosticLogger, LogLevel } from "./types";

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, val]) => {
      if (/password|secret|token|authorization|api.?key|credential/i.test(key)) return [key, "[REDACTED]"];
      return [key, redact(val)];
    }));
  }
  return value;
};

/** Minimal console-backed logger. Replaceable by a remote sink without changing modules. */
export const logger: DiagnosticLogger = {
  log(level: LogLevel, message: string, context: DiagnosticContext) {
    const entry = redact({ level, message, timestamp: new Date().toISOString(), ...context });
    const method = level === "critical" || level === "error" ? "error" : level === "warning" ? "warn" : level === "debug" ? "debug" : "info";
    console[method](entry);
  },
};
