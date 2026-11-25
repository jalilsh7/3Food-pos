/** Cross-module diagnostic contract. Keep payloads free of credentials and customer secrets. */
export type LogLevel = "debug" | "info" | "warning" | "error" | "critical";
export interface DiagnosticContext {
  module: string;
  action: string;
  correlationId?: string;
  code?: string;
  [key: string]: unknown;
}
export interface DiagnosticEntry extends DiagnosticContext {
  level: LogLevel;
  timestamp: string;
  message: string;
}
export interface DiagnosticLogger {
  log(level: LogLevel, message: string, context: DiagnosticContext): void;
}
