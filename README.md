# 3Food POS

Private repository for the 3Food POS application.

## Current architecture

- Frontend: React 19 + TypeScript + Vite + TanStack Router, built as a static SPA.
- Backend: same-origin PHP API under `php-backend/public/api`.
- Database: MySQL/InnoDB; no Node server is required on the cPanel host.
- Authentication: PHP server-side sessions, username/password and server-enforced role permissions.
- Deployment target: cPanel/LiteSpeed with PHP 8.2 and MySQL.

The active cPanel runtime must remain independent of Grok/App Builder, Better Auth, TanStack Start/Nitro, PostgreSQL/PGLite, preview-host identity and injected platform scripts. Optional SMS delivery remains an explicitly configured server-side integration.

## Cleanup branch

The ongoing platform-removal and dependency cleanup is isolated on [`cleanup/remove-grok-dependencies`](https://github.com/jalilsh7/3Food-pos/tree/cleanup/remove-grok-dependencies), with review in [PR #1](https://github.com/jalilsh7/3Food-pos/pull/1). It has not been merged into `migration/php-mysql` and has not been deployed.

Completed on the cleanup branch:
- Removed the orphaned Better Auth/OAuth, PGLite/PostgreSQL, TanStack Start server and App Builder connector source trees.
- Removed obsolete preview-host helpers, old platform-specific brand/preview scripts and superseded auth analysis documents.
- Removed direct package dependencies that belonged only to the retired runtime.
- Added source-graph and built-output audits to `build:cpanel`.
- Updated the browser smoke runner to test the standalone SPA without platform auth/brand gates.
- Kept the PHP API, MySQL schema/migrations, POS screens, role model, stock/order logic and optional server-side SMS integration.

Full CI succeeded in [run 44280981233](https://github.com/jalilsh7/3Food-pos/actions/runs/44280981233): PHP syntax, fresh MySQL schema, PHP API integration, TypeScript, unit tests, lint, cPanel build, Playwright smoke against the packaged app and artifact upload. The dependency manifest and lockfile are synchronized; the direct dependency set has been reduced to the libraries used by the SPA and its build/test tools.

## Not yet a production release

- The cleanup PR is still separate from the migration branch.
- The generated `3food-pos-cpanel` artifact from run 44280981233 is available until 2026-12-02; validate it on a staging cPanel host with PHP/MySQL before any production deployment.
- The packaged app passed Playwright smoke in desktop and mobile viewports. Typing 46 test characters took 42 ms for username and 32 ms for password in the CI runner, without submitting the form. Real staging/device end-to-end testing is still required for sign-in/out, role restrictions, orders, stock and multi-device consistency.
- Backup/restore and live SMS integration tests remain separate release gates.
- No cleanup operation has modified the live cPanel files or production database.

## Project guidance

- Persian handoff: [AI_HANDOFF_FA.md](AI_HANDOFF_FA.md)
- Agent rules: [AGENTS.md](AGENTS.md)
- Implementation status: [IMPLEMENTATION-STATUS-FA.md](IMPLEMENTATION-STATUS-FA.md)
- Static build analysis: [docs/static-build-readiness.md](docs/static-build-readiness.md)
- Historical migration audit: [SOURCE-AUDIT-PHP-MYSQL-FA.md](SOURCE-AUDIT-PHP-MYSQL-FA.md) (describes the pre-migration source snapshot, not the current architecture)

All production changes require explicit owner approval, a backup and a rollback plan.
