# Platform API boundary

The existing PHP client remains the compatibility façade for all current screens while the architecture is migrated. It is responsible for same-origin requests, HttpOnly cookie session usage, CSRF token handling, JSON envelope validation and stable user-facing API errors.

## Current migration step
- Request correlation ID is sent as `X-Correlation-ID`.
- API failure diagnostics use the shared logger and avoid query strings.
- PHP response helper echoes a validated request correlation ID (or generates one).
- No request body, credential, CSRF token, or raw provider response is logged.

## Migration policy
Keep existing `phpApi` method signatures until feature modules move behind service adapters. Future extraction separates contracts, transport, auth/session, and resource service functions; avoid changing endpoints in this step.