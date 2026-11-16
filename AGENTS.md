# Instructions for coding agents

Read `AI_HANDOFF_FA.md` and all relevant files under `docs/` before changing code.

- Work only on `migration/php-mysql`; do not modify `main` unless the repository owner explicitly authorizes it.
- Verify the current Git tree and actual files before trusting status notes.
- The full source and PHP backend have NOT yet been transferred to this branch as of 2026-11-17.
- Do not invent test results, deployment status, files, or completed features.
- Never commit secrets, database passwords, private keys, real config files, tokens, or production data.
- Keep real PHP configuration outside the public web root and out of Git.
- Preserve the original source archive; compare files by SHA-256 before merging.
- Do not deploy to production or overwrite staging data without explicit owner approval and a verified backup.
- Run relevant tests after each change and record exact commands/results in `docs/phase-2-backlog.md`.
- The product must use PHP/MySQL as the server-side source of truth, with secure username/password authentication, roles manager/cashier/kitchen, manager-only order editing, CSRF protection, idempotent transactional orders, and multi-device synchronization.
- The owner is non-technical. Give concise Persian instructions and ask only for genuinely blocking input.
