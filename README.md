# 3Food POS

Private repository for the 3Food POS application.

## Current migration status

The working branch `migration/php-mysql` now contains the React/Vite source, PHP API, MySQL schema and migrations. The PHP backend covers session authentication and roles, central bootstrap/records, order creation and status transitions, server-side order-line pricing, idempotency, transactional stock and loyalty effects, coupon validation/redemption, cancellation reversals, and SMS dispatch through private server configuration.

Recent GitHub Actions checks have passed for PHP syntax, TypeScript, unit tests and ESLint. The latest verified order-pricing commit is `f7782071dee382236d2592000173801d92a1e8f3`; the cPanel rewrite/test changes are tracked separately on this branch.

## Not yet a production release

- The React app still uses the TanStack Start/Nitro build configuration; a verified static SPA build for cPanel has **not** been produced.
- Some POS state still uses Zustand persistence and not every UI operation has complete server-side synchronization.
- Real MySQL concurrency/integration tests, multi-device end-to-end tests, backup/restore verification and live SMS tests remain outstanding.
- The cPanel `.htaccess` now places the PHP API rewrite before a guarded SPA fallback. This does not itself create the static `index.html` or prove the deployed app works.

Do not deploy to the production host until the static build, API integration, staging MySQL and browser end-to-end checks pass. Keep secrets outside Git and outside the public document root.

## Project guidance

- Persian handoff: [AI_HANDOFF_FA.md](AI_HANDOFF_FA.md)
- Agent rules: [AGENTS.md](AGENTS.md)
- Implementation status: [IMPLEMENTATION-STATUS-FA.md](IMPLEMENTATION-STATUS-FA.md)
- Static build analysis: [docs/static-build-readiness.md](docs/static-build-readiness.md)

All migration work must remain on `migration/php-mysql`; do not modify `main` without explicit owner approval.
