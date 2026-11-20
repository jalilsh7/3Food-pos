# AI Handoff Guide — PersiaCoder POS V3 Commercial Edition

> This document is the continuation contract for any AI assistant or engineer taking over this repository. Read it before editing code. It records the project as observed on the development branch; it is not a claim that unrun tests, migrations, or deployments succeeded.

- Repository: https://github.com/jalilsh7/3Food-pos
- Active development branch: `feature/3food-pos-next-release-v2`
- Protected-by-process branch: `main` (do not modify for routine development)
- Product: **PersiaCoder POS V3 — Commercial Edition**
- Product brand is fixed: **PersiaCoder.ir**; every application page must carry the subtle footer text **Powered by PersiaCoder.ir**.
- Audience: restaurants, cafés, fast-food, juice bars and ice-cream shops.
- Current code baseline: `d364efc9d72f66b680401f8ec53f7fa34d183df0` on 2026-11-20. Documentation records the prior order-integration code baseline `f6ab1a6a9b8e47674f5a01e2c322567c9c15d612`; always fetch the live branch head before relying on either SHA.

## 1. Mandatory working rules

1. Work only on `feature/3food-pos-next-release-v2` unless the product owner explicitly changes this instruction.
2. Do not merge into, force-push, or make routine edits directly to `main`. Do not deploy to production.
3. The owner has authorized continued implementation and routine low-risk engineering without asking for approval at every step. Make sensible decisions and keep moving.
4. Explicit approval is still required before destructive data operations, running migrations against a real/customer database, irreversible deletion, production changes/deployment, real payment/card-terminal transactions, or changing repository ownership/visibility.
5. Use GitHub for repository work. Before editing an existing file, fetch its current contents and blob SHA from the target branch. Use that fresh SHA for updates; after writing, fetch again and verify the resulting content and branch commit.
6. Never assume a previous assistant's claim is true without checking the repository. This is especially important for the status of endpoints, migrations, tests and generated artifacts.
7. Never commit secrets, API keys, passwords, customer data, payment credentials, private media, or real environment files. Document variable names, never their values.
8. Keep the project notes and roadmap current as each meaningful package is completed. Do not mark work complete merely because code was drafted.
9. The owner prefers continuous implementation: do not interrupt for routine confirmations. Report material risks clearly and ask only when an explicit approval boundary is reached.
10. User-facing progress and handoff reports should be in Persian.

## 2. Testing policy — updated 2026-11-20

Testing is now allowed during development. Do not defer every test until the end.

### Run during implementation (P0 / critical)
Run the relevant checks as soon as a critical component or vertical slice is implemented, and run them again after a related fix:
- PHP syntax/lint and static checks for touched backend code.
- Authentication, session revocation, CSRF, same-origin/Origin validation, login throttling and RBAC/tenant isolation.
- Database constraints, transaction rollback/atomicity, concurrency and idempotency for money/order/stock mutations.
- Server-side price calculation and order/payment state separation.
- Backup integrity and restore safety before any release candidate.
- Security checks proving unauthorized business/branch data cannot be read or modified.

### Run during the corresponding phase (P1 / important)
- API contract and validation checks, catalog/order/dining/inventory/cash workflow integration.
- Frontend typecheck and production build.
- Browser/responsive checks for major daily workflows.
- MySQL and MariaDB compatibility checks.

### Keep in the final test backlog (P2 / lower priority)
Do not let these block normal implementation unless a concrete defect makes them critical:
- Minor visual spacing, icon alignment and non-blocking animation details.
- Rare edge cases in secondary filters/sorting and low-traffic helper screens.
- Extended browser/device matrix beyond the primary supported browsers and viewport sizes.
- Cosmetic accessibility refinements after core keyboard and screen-reader blockers are addressed.
- Non-critical performance profiling and large-scale load tests after the main data model stabilizes.
- Full end-to-end regression across every module and every role.
- Final installation/upgrade/backup/restore acceptance rehearsal on clean staging environments.

Maintain a dedicated backlog section in `PROJECT_NOTES.md` (or a linked test plan) with: test ID, scope, priority, trigger/dependency, status, evidence/run URL and defect link. Do not delete deferred tests; close them only after evidence exists. A test is not passed just because a workflow was started. Record distinct states: not run, queued/deferred, running, passed, failed, blocked.

## 3. Current project architecture

### Product and deployment
- V3 is a standalone commercial POS. It must not depend on V2 runtime, V2 PHP includes, V2 session, V2 database bootstrap or V2 schema.
- Target customer hosting: cPanel/LiteSpeed, PHP 8.2+, MySQL 8.0.16+ or MariaDB 10.6+ (verify exact compatibility in CI/staging).
- The POS runtime and its database are installed independently for each customer.
- Storefront is a separate ordering channel. WooCommerce integration is optional; V3 must not require WooCommerce.
- No White Label mode. Keep PersiaCoder.ir branding.
- First release is food-and-beverage verticals. A generic retail vertical is out of current scope.

### Main repository areas
- `v3/frontend/`: React + TypeScript + Vite RTL application.
- `v3/backend/`: standalone PHP API runtime and domain services.
- `database/v3/schema.sql`: clean-install baseline schema.
- `database/v3/migrations/`: additive, ordered schema migrations.
- `database/v3/bin/`: install, migration, preflight, backup and restore CLI tools.
- `scripts/`: repository checks and helper scripts.
- `ROADMAP_V3.md`: phase-level delivery roadmap.
- `PROJECT_NOTES.md`: decisions, work log, open issues and backlog.
- `POS_V3_UX_ARCHITECTURE.md`: product UX and navigation contracts.
- `BACKEND_ARCHITECTURE_V3.md`: backend/security architecture (some early introductory paragraphs may be stale; reconcile against implementation sections and source).
- Domain design references include `ORDER_LIFECYCLE_STOREFRONT_V3.md`, `ORDER_DATA_MODEL_V3.md`, `PAYMENT_LEDGER_V3.md`, `FINANCE_INVENTORY_DATA_MODEL_V3.md`, `COMMERCIAL_CORE_ERD_V3.md`, `SETTINGS_POLICY_ENGINE_V3.md`.

## 4. Implemented work recorded in the repository — verify before extending

The following implementation is documented in the current backend architecture / project notes. Confirm actual source and route registration before depending on it:

- HTTP foundation: Request, Response, Router, Kernel, JSON errors, request IDs, body/query limits and configuration validation.
- PDO connection factory and transaction manager.
- Authentication: password hashing/verification, dummy hash for unknown usernames, inactive-user rejection, password rehash, session creation and login throttling.
- Server-side sessions: only token hashes persisted; session expiry/revocation/session version and secure cookies.
- CSRF middleware and same-origin checks for state-changing requests.
- Auth routes and password change support.
- Business and branch scope, roles, permission resolution, user/role/business/branch administration.
- Append-only audit logging and audit-log read endpoint.
- Transactional idempotency service with request fingerprint, scoped key, encrypted stored response and replay behavior.
- Catalog categories/products, variants, option groups/options and product lifecycle APIs.
- Private media upload/storage and business-scoped media retrieval.
- Order creation and order state changes, with server-authoritative prices and snapshots.
- Dining areas/tables/table sessions.
- Inventory foundations and cash-register foundations are present in the backend tree; inspect routes and service coverage before assuming complete business workflows.
- Migration history is additive and has reached at least migration 011 in the project notes. Migrations are definitions only until explicitly applied to a disposable test/staging database.

Important: the source tree and docs have evolved quickly. A stale document heading may say a subsystem is not implemented even though later sections document it. The actual source files, route table and current CI are authoritative for implementation status.

## 5. Database and deployment safety

- Baseline schema is documented as 61 tables in `database/v3/schema.sql`.
- CLI tooling includes clean-database installation, checksum-tracked migrations, preflight, compressed signed backup and guarded restore.
- Backup uses HMAC-SHA256 and an environment-provided key; restore validates integrity before DDL and is intended for an empty target database.
- Never run installer, migration, restore or destructive database checks against a customer's or production database.
- For test runs, use disposable MySQL/MariaDB services and synthetic data only.
- Migration files must be additive, ordered and immutable after being applied. Never edit an already-applied migration; add a new migration.
- Do not claim MySQL/MariaDB compatibility until both engines have passed their CI/staging test matrix.

## 6. Commercial and domain invariants

- All order channels converge into one order-management center: POS, telephone, manual, dine-in/table, takeaway, delivery and online storefront.
- Order status, payment status, preparation status and fulfillment/delivery status are independent state dimensions.
- Frontend-supplied prices/totals/tax/discount/delivery charges are never authoritative. Backend recalculates and persists immutable price snapshots.
- Payment methods at the POS include cash, bank terminal, split/tender combinations and credit only when explicitly permitted. Online gateway is optional for storefront, not a prerequisite for POS.
- A card-terminal integration must use an adapter/driver architecture. Never claim support for a terminal model/provider until its real protocol and device have been tested.
- Inventory quantity changes only through controlled stock documents/ledger operations, not by editing catalog or recipe records.
- Financial and stock ledgers are append-only; corrections use reversal/adjustment entries.
- Multi-business and branch isolation must be enforced in repository queries and services, not just UI.
- Use least privilege and deny-by-default for permissions.
- Idempotency is required for sensitive create/financial/order/stock commands and must be atomic with the domain mutation.
- Audit events for sensitive mutations must be committed with the business transaction and must not include secrets or unnecessary personal data.

## 7. Frontend status and UX principles

- Frontend is React/TypeScript/Vite, Persian-first and RTL.
- Existing feature workspaces include overview, POS, orders, kitchen, catalog, inventory, customers, finance, settings and storefront.
- Some earlier UI workspaces were prototypes using local state. Do not represent local/demo state as persisted or live server data. Check each feature's current API integration before describing it as operational.
- Overview must not fabricate KPIs; unknown live values should remain clearly unavailable.
- Keep navigation grouped by daily operations, catalog/resources and management.
- Keep screens task-focused and simple for restaurant operators; progressive disclosure is preferred over dense configuration screens.
- Brand footer remains subtle and consistent.

## 8. Known issues, caveats and current verification baseline

- Historical GitHub Actions run `44633009762` (2026-11-19) started real Ubuntu runners and failed PHP lint on `v3/backend/src/Infrastructure/Database/UserRepository.php` with a parse error near the owner-role query. The current branch version was freshly fetched on 2026-11-20 and the SQL string appears syntactically closed; this historical failure must be rechecked by a new workflow run, not treated as a current confirmed defect or as a pass.
- Root cause confirmed: both owner-role SQL literals used unescaped single quotes inside a single-quoted PHP SQL string. Both occurrences were escaped in commit `330aaa01c0171fac072d3a301b6993552a6d70ed`; verify the new CI run before marking the defect closed.
- A follow-up CI run confirmed PHP syntax, bootstrap configuration and HTTP kernel checks pass on PHP 8.2/8.3/8.4 after the SQL fix. It then exposed a stale test fixture: `scripts/check-v3-backend-database.php` passed 8 constructor arguments after `Configuration` expanded to 10. The two fixture calls were updated in commit `d53de809e65a796082779664a68a6bbe8a72381b`; verify the next run. This is a test-harness defect, not a production DB connection failure.
- Frontend `package.json` exists, but the inspected tree did not expose `v3/frontend/package-lock.json`; verify whether a lockfile exists elsewhere before claiming reproducible npm installs.
- `v3/backend/composer.json` was not found at the inspected path. Verify the current backend dependency/bootstrap strategy; do not invent Composer dependencies or a lockfile.
- The inspected frontend package scripts include `typecheck` and `build`; do not assume they passed.
- No customer database migration, production deployment, real terminal transaction or real gateway transaction has been performed as part of this handoff.
- Test history must be refreshed from GitHub Actions before the next status report. The last historical failed run is evidence of failure at that commit only.

## 9. Recommended next actions (execute in order)

1. Fetch the latest branch list and latest commit SHA. Confirm the active branch still exists and is not behind unexpectedly.
2. Inspect current workflow definitions under `.github/workflows/`, list latest workflow runs and job logs. Separate runner/setup failures from code/test failures.
3. Run the relevant existing CI workflows on the current branch. Start with PHP lint and backend checks; then MySQL 8.4 + MariaDB 10.6 integration; then frontend typecheck/build. Fix failures on the feature branch.
4. Reconcile stale documentation, especially the introductory status in `BACKEND_ARCHITECTURE_V3.md`, with actual source and route registration. Keep claims evidence-based.
5. Continue the backend vertical slices: complete inventory operations/recipe consumption and cash/payment ledger flows; then kitchen, fulfillment, storefront and integration adapters.
6. Connect frontend workspaces to real API contracts incrementally. Remove or clearly label any remaining mock/local-only behavior.
7. Add/maintain high-value automated tests with each critical slice. Keep P2 tests in the final backlog.
8. Complete clean-install, migration, backup/restore, security, cross-tenant isolation, browser and end-to-end acceptance on disposable staging.
9. Only after acceptance criteria pass, prepare release packaging and the separately requested transfer to the owner's other GitHub account. Do not guess the destination account/repository.

## 10. How to continue safely with GitHub

For each work package:
1. Read this guide, `ROADMAP_V3.md`, relevant sections of `PROJECT_NOTES.md`, and the subsystem architecture doc.
2. Fetch the latest target branch head and each file's current content/SHA.
3. Inspect call sites, routes, migrations, schema constraints and tests before editing.
4. Implement one coherent, reviewable package on the feature branch.
5. Add/update relevant tests for P0/P1 behavior. If a test is deferred, add it to the explicit backlog with a reason.
6. Update roadmap, notes and architecture docs in the same package.
7. Commit with a descriptive message; verify the new commit and re-fetch changed files.
8. Trigger relevant GitHub Actions and report exact run links/results. Never claim a test passed without a completed successful result.
9. Report: package ID, files, commit, tests (passed/failed/not run/deferred), open risks and next action.

## 11. Owner decisions that must not be silently reversed

- Fixed brand: PersiaCoder.ir; footer: Powered by PersiaCoder.ir; no White Label.
- V3 remains independent from V2.
- Customer-hosted installation is a core target.
- Restaurant/food-and-beverage first; general retail later.
- One order center across all sales channels.
- Backend is authoritative for permissions, price, stock and money.
- POS payments and optional storefront online gateway are separate concerns.
- Keep feature branch workflow and do not touch production/main without explicit approval.
- Low-priority tests must remain recorded until completed; do not silently drop them.

---
Last updated: 2026-11-20. Treat this as a living handoff document; update it after every substantial architecture or workflow change.

 
## 12. Inventory read API package — 2026-11-20
- Added `GET /api/v1/inventory/balances` and `GET /api/v1/inventory/ledger`.
- Both routes require an authenticated session, `inventory.read` permission and a resolved branch context.
- SQL enforces `business_id` and `branch_id`; document and document-line joins in the ledger query also include both scope keys.
- Balance response exposes on-hand, reserved and available quantities; it deliberately omits average cost/valuation from the general inventory read permission.
- Ledger response is newest-first and uses a descending numeric `before_id` cursor; public payload omits internal ledger row IDs.
- Regression script: `scripts/check-v3-backend-inventory-read.php`, wired into `.github/workflows/v3-backend-validation.yml`. The script asserts query scope predicates and bindings; it is not a substitute for MySQL/MariaDB integration tests.
- Latest inventory package commit before docs: `1b1ae0a83269680a5f69eb15dd473efef858e515`; docs commits follow. Re-fetch latest branch and verify CI.
- Next vertical slice: transactional stock documents (purchase receipt, transfer, adjustment, waste, return), append-only ledger posting, atomic balance updates, negative-stock guard, idempotency and audit. Do not mutate balances outside ledger-backed posting.

 
## 13. Recipe API integration package — 2026-11-20
- RecipeController/RecipeService were present but not registered in the HTTP front controller. They are now wired through a lazy controller factory.
- Routes: product recipe read, draft recipe-version creation, and recipe-version activation.
- Read requires `catalog.read`; writes require `catalog.manage`, session, CSRF, same-origin validation and idempotency keys.
- Regression contract: `scripts/check-v3-backend-recipe-routes.php`, wired into Backend Validation workflow.
- Recipe unit conversion factors are resolved and persisted as snapshots by the existing service/repository. Recipe activation retires the previous active version in the same idempotent transaction.
- CI has not yet been confirmed for this package. Re-fetch current branch and workflow result before claiming green.



## 14. Inventory documents — INV-02A1 (2026-11-20)
- Added draft stock document header APIs: list, detail and create.
- New files: `v3/backend/src/Infrastructure/Database/InventoryDocumentRepository.php`, `v3/backend/src/Inventory/InventoryDocumentService.php`, `scripts/check-v3-backend-inventory-documents.php`.
- Updated `InventoryController.php`, `v3/backend/public/index.php`, and `.github/workflows/v3-backend-validation.yml`.
- Supported draft types: purchase_receipt, consumption, transfer, adjustment_in, adjustment_out, waste, return.
- Source/destination locations are resolved within the active business+branch. Supplier is resolved within business; purchase receipt requires one. Transfers require a different destination.
- Numbering uses `pos_sequences` with a business+branch-specific key and `SELECT ... FOR UPDATE`; create is idempotent and audited.
- Draft line creation is also implemented at `POST /api/v1/inventory/documents/{documentPublicId}/lines`; it validates business-scoped stock item, unit dimension and conversion availability, locks the draft document, and stores a conversion factor snapshot plus base quantity.
- Important boundary: line update/delete and posting are not implemented. Drafts never append ledger rows or change balances. Cost snapshots are not computed; never interpret their schema defaults as actual costs.
- Runtime requires migration 011; do not execute migrations against production or a real customer database without explicit approval.
- Static regression contract is wired into Backend Validation; wait for the new workflow result before claiming PASS. Real MySQL/MariaDB integration remains outstanding.
- Next: add draft line CRUD with unit conversion snapshots and strict decimal handling; only then implement posting with row locks, append-only ledger, atomic balance updates, negative-stock protection and rollback.


## 15. CI triage and fixes — 2026-11-20
- On pre-fix HEAD `c0ccb5c744f7d9e5713ff9172853a132545bb90a`, V3 Backend Validation passed for PHP 8.2, 8.3 and 8.4.
- The separate frontend validation failed because V3 frontend requested TypeScript `5.7.0`, which npm could not resolve. V3 frontend now pins `5.7.2`.
- The PHP migration workflow reached lint/unit/integration work but ESLint failed parsing a duplicated/truncated `OrderCenter.tsx`; the file was repaired to use one consistent detailed DemoOrder model and component.
- V3 database validation stopped in the SQL parser contract because its old threshold expected 100 parsed statements. Current baseline has 61 CREATE TABLE declarations and 65 parsed statements; contract now asserts those actual minimums.
- Fix commits: `d5f23c0`, `ab3c639`, `b6553d7`. CI re-runs are pending; do not report them passed until completed.
- Inventory package INV-02A1 exists in current branch: draft document header/list/detail and draft line creation only. No ledger or balance writes occur. Line update/delete and posting remain open.
- Never execute migration 011 against a customer/production DB without explicit approval. MySQL/MariaDB CI uses disposable service databases only.


## 16. Inventory draft line CRUD — INV-02A2 (2026-11-20)
- Migration `012_stock-document-line-public-ids.sql` adds a UUID public ID to stock document lines, backfills existing rows with UUID(), then enforces NOT NULL and scoped uniqueness on business/branch/document/public_id.
- Draft line create now returns its public `id`; document detail includes each line's public ID.
- Update route: `PATCH /api/v1/inventory/documents/{documentPublicId}/lines/{linePublicId}`.
- Delete route: `DELETE /api/v1/inventory/documents/{documentPublicId}/lines/{linePublicId}`.
- Both require authenticated session, branch context, `inventory.manage`, CSRF, same-origin and Idempotency-Key. The service locks the scoped draft header and then the scoped line row, rejects non-draft documents, writes audit records and executes within the idempotent transaction.
- Update revalidates stock item, unit dimension, conversion factor and positive decimal quantity; it stores a new conversion-factor snapshot/base quantity. No valuation/costing is performed.
- Draft CRUD does not touch `pos_stock_ledger` or `pos_stock_balances`. Posting remains intentionally unimplemented pending costing/financial policy review.
- Migration 012 is committed but not applied to any customer/production database. Database CI uses a disposable migration probe sequence 013.
- Contract checks include migration backfill/public ID uniqueness, route handlers, idempotency scopes and no ledger/balance mutation. Real MySQL/MariaDB concurrency/rollback integration tests remain outstanding.
- The V3 frontend typecheck and production build passed at code HEAD `a8560e4`; recheck Backend, DB and PHP migration workflows on the newest HEAD before marking the package green.


## 17. CI green confirmation — code HEAD 88cc9a9 (2026-11-20)
- Backend Validation passed on PHP 8.2/8.3/8.4: [run 44693350404](https://github.com/jalilsh7/3Food-pos/actions/runs/44693350404).
- V3 Frontend TypeScript and production build passed: [run 44693350646](https://github.com/jalilsh7/3Food-pos/actions/runs/44693350646).
- V3 schema/engine validation passed on MySQL 8.4 and MariaDB 10.6: [run 44693342518](https://github.com/jalilsh7/3Food-pos/actions/runs/44693342518). Both engines applied migrations 001–013 in disposable CI DBs and passed installer, migration checksum/idempotency, backup/restore and tamper rejection checks.
- PHP migration workflow passed: [run 44693350474](https://github.com/jalilsh7/3Food-pos/actions/runs/44693350474), including MySQL API integration, TS, unit, lint, cPanel build, Chromium smoke and performance budget.
- MySQL restore FK validation now uses explicit lower-case aliases with PDO::FETCH_ASSOC. Migration 006 separates the composite self-referencing category FK into a subsequent ALTER for MariaDB 10.6 compatibility. Migration smoke fixture is `013_ci-smoke.sql`; real migration 012 is stock line public IDs.
- INV-02A2 line create/update/delete contract passed Backend CI. It is not yet a full DB integration test of document lifecycle. Do not treat this as evidence that inventory posting, ledger writes or balance updates work.
- Next: review inventory valuation/costing policy and financial amount semantics before implementing posting. Keep ledger append-only, balance mutation atomic, negative stock guarded, and concurrency/idempotency/rollback integration tests mandatory.
- No migration was run on any customer/production database.


## 18. Inventory posting and valuation — INV-02B1 (2026-11-20)
- Implemented `POST /api/v1/inventory/documents/{documentPublicId}/post`. Requires session, CSRF, same-origin, branch-scoped `inventory.manage`, Idempotency-Key and audit. The entire post runs in one idempotent DB transaction.
- The posting flow locks the draft header, line rows, then all affected stock balances in deterministic item/location order. It appends ledger rows, updates balances and marks the document posted. Any failure rolls back the complete posting.
- Costing method: Moving Weighted Average per stock item per location. Monetary amounts are integer TOMAN; line `total_cost_amount` is supplied for purchase receipts and inbound adjustments; `unit_cost_snapshot` is cost per base unit. SQL DECIMAL arithmetic is used; do not introduce PHP floats.
- Supported posting types: `purchase_receipt` -> `purchase_in`; `adjustment_in`; `adjustment_out`; `consumption` -> `consumption_out`; `waste` -> `waste_out`; `transfer` -> paired `transfer_out` and `transfer_in` with balanced value.
- Outgoing movement is blocked if on-hand less reserved is insufficient. No negative stock. The ledger is append-only at application/API level; there are no ledger update/delete routes.
- General document detail omits valuation. Protected endpoint `GET /api/v1/inventory/documents/{documentPublicId}/valuation` requires branch-scoped `inventory.manage` and returns TOMAN cost snapshots.
- Document type `return` can be drafted but posting returns `stock_document_type_not_postable` until source-linked return semantics and historical cost restoration are implemented. Do not use current weighted average as a substitute for original sale/receipt cost.
- Real DB integration test `scripts/check-v3-inventory-posting-integration.php` covers two purchase receipts, weighted average, valuation permission data service, cost privacy in general detail, consumption, transfer, idempotency replay, insufficient stock and atomic multi-line rollback. The DB workflow also verifies binary idempotency nonce/tag survive backup/restore v2.
- Verified Backend run: [44697072239](https://github.com/jalilsh7/3Food-pos/actions/runs/44697072239). Verified DB engine run: [44697072230](https://github.com/jalilsh7/3Food-pos/actions/runs/44697072230), both MySQL 8.4 and MariaDB 10.6 passed. PHP migration workflow on the same latest code was still running at handoff update.
- Remaining: race/concurrency test with separate connections, cross-business/branch negative tests, reserved stock scenarios, adjustment in/out scenarios, return source links, UI/API integration. Never run migrations on customer/production DB without explicit approval.


## 19. Final INV-02B1 verification — code HEAD 9e800c9
- Backend Validation PASS on PHP 8.2/8.3/8.4: [44698948479](https://github.com/jalilsh7/3Food-pos/actions/runs/44698948479).
- V3 Frontend TypeScript/build PASS: [44698948599](https://github.com/jalilsh7/3Food-pos/actions/runs/44698948599).
- V3 DB validation PASS on MySQL 8.4 + MariaDB 10.6: [44698942685](https://github.com/jalilsh7/3Food-pos/actions/runs/44698942685).
- PHP migration workflow PASS including PHP API integration, TS, unit, lint, cPanel build, Chromium smoke, desktop/mobile performance and package artifact: [44698948522](https://github.com/jalilsh7/3Food-pos/actions/runs/44698948522).
- Real DB posting integration now covers weighted-average receipts, inbound/outbound adjustments, consumption, transfer symmetry, reserved stock, waste, blocked unlinked return, business/branch isolation, idempotency replay, multi-line atomic rollback and concurrent competing postings. MySQL and MariaDB both confirm exactly one concurrent issue succeeds while the other is blocked.
- Deadlock root cause: duplicate-key insert path could cause lock upgrade. Balance creation now uses `INSERT ... ON DUPLICATE KEY UPDATE`; item/location rows use shared locks, balances use exclusive row locks. Keep this ordering unless a new concurrency test proves an alternative.
- Backup format v2 encodes binary columns as tagged base64 values; restore supports legacy v1 and new v2. Binary idempotency nonce/tag lengths are verified after restore.
- Return document draft is allowed, but posting deliberately rejects it until a source order/receipt line and historical cost restoration are available.
- Remaining critical work: connect frontend login/session to Auth API, then inventory UI to real APIs; integrate order reservations/recipe consumption; implement source-linked return. No customer/production migrations were executed.


## 20. Frontend authentication integration — FE-01A (2026-11-20)
- Added `v3/frontend/src/shared/api/client.ts`: same-origin fetch, no-store, configurable `VITE_API_BASE_URL` defaulting to `/api/v1`, CSRF token held only in module memory. Never persist session or CSRF credentials to localStorage/sessionStorage.
- Added Persian RTL `AuthScreen` for login and forced initial password change. App bootstraps with `GET /auth/me`; authenticated shell displays the real user and supports CSRF-protected logout.
- Logout errors keep the authenticated shell visible rather than falsely claiming logout. Password change clears cookies server-side and invalidates previous sessions via session_version; user signs in again.
- Added `scripts/check-v3-auth-integration.php`, executed in the disposable MySQL/MariaDB database workflow after migrations and inventory posting integration. It verifies login, hashed session/CSRF storage, session introspection, CSRF rotation, forced password change, old-session invalidation, re-login and logout.
- CI at code HEAD `5f44d7e`: Backend PASS PHP 8.2/8.3/8.4 [44701020452](https://github.com/jalilsh7/3Food-pos/actions/runs/44701020452); Frontend TypeScript/build PASS [44701020496](https://github.com/jalilsh7/3Food-pos/actions/runs/44701020496); MySQL 8.4 + MariaDB 10.6 PASS including auth and inventory posting integration [44701012524](https://github.com/jalilsh7/3Food-pos/actions/runs/44701012524).
- Auth integration found and fixed an audit snapshot key rejected by the sensitive-field filter: use `forced_change_required`, not a key containing `password`. No credentials or raw session tokens are written to audit snapshots.
- Business/branch context selection exists in `v3/frontend/src/features/auth/BusinessContextScreen.tsx`; the active context is persisted as public identifiers only and sent in scope headers. InventoryWorkspace has live read/write APIs for its current inventory document workflows; confirm exact endpoint coverage from source before claiming full module completion.
- ORD-01A (code commit `f6ab1a6a9b8e47674f5a01e2c322567c9c15d612`): `OrderCenter` no longer uses demo orders. It reads `GET /api/v1/orders` and `GET /api/v1/orders/{id}`, including item/options snapshots and status history. Filters include backend status/channel plus client-side payment/fulfillment/search over at most 100 recent orders. The UI is read-only; do not enable status transitions until RBAC, idempotency and error UX are connected.
- CI at the code baseline: Backend PASS on PHP 8.2/8.3/8.4 (run `44705608241`); Frontend TypeScript and production build PASS (run `44705608244`). PHP migration/legacy integration run `44705608232` failed at ESLint after PHP syntax, MySQL schema installation, PHP API integration, TypeScript and 81 unit tests passed. ESLint reported `react-hooks/set-state-in-effect` in App, BusinessContextScreen, InventoryWorkspace and OrderCenter. Fixes were committed in `3aa518e`, `faa988b`, `2ca77b1` and `d364efc`; reruns `44706018603` (PHP migration), `44706018612` (Frontend build) and `44706018626` (Backend matrix) were pending/in progress at the time of this update. Do not claim lint/full CI success until the rerun completes. Earlier backend run failures were traced to doubled namespace backslashes in SupplierRepository/SupplierService and have been corrected.
- Remaining: test order list/detail integration against disposable MySQL/MariaDB with branch isolation and role matrix; add cursor pagination and date filters; implement permitted status transitions and kitchen actions using existing backend state machine and fresh Idempotency-Key; connect Catalog/POS/Kitchen/Customers/Finance/Storefront to real APIs and remove demo data from operational flows. Keep every remaining prototype explicitly labeled.


## Latest continuation package — ORD-01A (2026-11-20)
- Frontend files changed: `v3/frontend/src/shared/api/client.ts`, `v3/frontend/src/features/orders/OrderCenter.tsx`.
- Commits: API client `34f6e09ad941a1164f183efd6d6a1d29916f1400`; OrderCenter `5559408b28973d0b9f9b550bcc4034d9b1f3d2a9`; supplier namespace fixes `a15c9ae905acf109cab41890693c829c47f6c56e` and `f6ab1a6a9b8e47674f5a01e2c322567c9c15d612`.
- Docs updated: `PROJECT_NOTES.md`, `ROADMAP_V3.md`, `BACKEND_ARCHITECTURE_V3.md`; this guide records the current implementation and test boundaries.
- No migration was executed against a customer or production database. No production deployment or merge into `main` occurred.


## LINT-01 — React effect follow-up (2026-11-20)
- The comprehensive workflow `44705608232` passed fresh MySQL schema install and PHP API integration, and all 81 unit tests passed, but ESLint failed on synchronous state updates in React effects.
- The four affected pages were adjusted so loading/reset state changes happen in event handlers while effects handle asynchronous fetch results: commits `3aa518eaf606d28e17345703d29c6e3b28b369f5`, `faa988bd03c781ca201232b68643da37b6a2c42d`, `2ca77b19911704044cfaa08fbd38743f15974cb3`, `d364efc9d72f66b680401f8ec53f7fa34d183df0`.
- Rerun state at update time: Frontend `44706018612` in progress; PHP migration `44706018603` in progress; Backend `44706018626` queued. Re-check all before marking LINT-01 complete.
