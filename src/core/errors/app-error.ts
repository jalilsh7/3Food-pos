export class AppError extends Error {
  readonly code: string;
  readonly module: string;
  readonly details?: unknown;
  constructor(message: string, code: string, module: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.module = module;
    this.details = details;
  }
}
