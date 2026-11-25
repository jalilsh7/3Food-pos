/** In-memory CSRF session state; intentionally not persisted to browser storage. */
let token: string | null = null;

export const csrfSession = {
  get(): string | null { return token; },
  set(next: string | null): void { token = next; },
  clear(): void { token = null; },
};
