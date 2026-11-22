# 3Food POS

Private repository for the 3Food POS application.

## Current architecture

- Frontend: React 19 + TypeScript + Vite + TanStack Router, built as a static SPA.
- Backend: same-origin PHP API under `php-backend/public/api`.
- Database: MySQL/InnoDB; no Node server is required on the cPanel host.
- Authentication: PHP server-side sessions, username/password and server-enforced role permissions.
- Deployment target: cPanel/LiteSpeed with PHP 8.2 and MySQL.
- Release package: `npm run build:cpanel` produces `dist-cpanel/` and `3food-pos-cpanel.zip`; the ZIP contains the public app, private config template and database migration files, never a live private config.

The active cPanel runtime must remain independent of Grok/App Builder, Better Auth, TanStack Start/Nitro, PostgreSQL/PGLite, preview-host identity and injected platform scripts. Optional SMS delivery remains an explicitly configured server-side integration.

## Active development branch and update policy

The current active development branch is [`feature/3food-pos-next-release-v2`](https://github.com/jalilsh7/3Food-pos/tree/feature/3food-pos-next-release-v2).

**The latest commit on the active development line is the source of truth for all ongoing work.** At the beginning of every task:

1. Fetch the latest remote branch state and inspect its HEAD commit and recent history.
2. Start from that latest HEAD; do not use an old local checkout, stale archive, or previously downloaded project snapshot as the base.
3. Keep changes on the active development branch unless the owner explicitly selects another branch.
4. Before changing the active branch, compare candidate branches by commit ancestry and included work—not just branch names or timestamps—and choose the line that preserves the newest integrated POS updates.
5. Do not base new work on `main` or `migration/php-mysql` when they are behind the active development line. Do not merge, reset, rebase destructively, or force-push branches without explicit approval.
6. After changes, report the branch and commit updated, and distinguish checks actually run from checks not run.

If a newer development branch supersedes the current one, verify its history and update this section so the README always identifies the current source of truth. Production deployment remains a separate, explicitly approved operation.

## Platform cleanup history

The platform-removal and dependency cleanup work was developed on [`cleanup/remove-grok-dependencies`](https://github.com/jalilsh7/3Food-pos/tree/cleanup/remove-grok-dependencies), with review history in [PR #1](https://github.com/jalilsh7/3Food-pos/pull/1). The active development line must be checked for the integrated state of that work; do not assume this historical cleanup branch is the current working base.

The cleanup work included:
- Removing orphaned Better Auth/OAuth, PGLite/PostgreSQL, TanStack Start server and App Builder connector source trees.
- Removing obsolete preview-host helpers, old platform-specific brand/preview scripts and superseded auth analysis documents.
- Removing direct package dependencies that belonged only to the retired runtime.
- Adding source-graph and built-output audits to `build:cpanel`.
- Updating the browser smoke runner to test the standalone SPA without platform auth/brand gates.
- Preserving the PHP API, MySQL schema/migrations, POS screens, role model, stock/order logic and optional server-side SMS integration.

Historical CI run: [44280981233](https://github.com/jalilsh7/3Food-pos/actions/runs/44280981233). Its reported checks covered PHP syntax, fresh MySQL schema, PHP API integration, TypeScript, unit tests, lint, cPanel build, Playwright smoke against the packaged app and artifact upload. Treat this as evidence for that run only; it does not replace checks on newer commits.

## Release and deployment safeguards

- The application is not considered production-ready solely because a branch or CI run is successful. Validate the current build on a staging cPanel host with the target PHP/MySQL configuration before production deployment.
- Real staging/device end-to-end testing is required for sign-in/out, role restrictions, orders, stock and multi-device consistency.
- Backup/restore and live SMS integration tests remain separate release gates.
- Do not modify live cPanel files or the production database during ordinary development work.
- All production changes require explicit owner approval, a backup and a rollback plan.

## Project guidance

- Persian handoff: [docs/v2/AI_HANDOFF_FA.md](docs/v2/AI_HANDOFF_FA.md)
- Agent rules: [AGENTS.md](AGENTS.md)
- Implementation status: [docs/v2/IMPLEMENTATION-STATUS-FA.md](docs/v2/IMPLEMENTATION-STATUS-FA.md)
- Static build analysis: [docs/v2/static-build-readiness.md](docs/v2/static-build-readiness.md)
- Historical migration audit: [docs/v2/SOURCE-AUDIT-PHP-MYSQL-FA.md](docs/v2/SOURCE-AUDIT-PHP-MYSQL-FA.md) (describes the pre-migration source snapshot, not the current architecture)
