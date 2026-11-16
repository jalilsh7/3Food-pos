# 3Food POS

Private repository for the 3Food POS application.

## Migration status

The original application is a React 19 / TypeScript / Vite / TanStack Start project. The PHP/MySQL migration archive adds an initial PHP API and MySQL schema, but it is not yet a deployable replacement.

Outstanding work before production:

- Connect the React UI to the PHP API and remove browser storage as the source of truth.
- Complete server-side order pricing, discounts, loyalty, inventory and concurrency handling.
- Complete customer-only SMS integration with server-side credentials.
- Complete backup/restore, multi-device and role-based end-to-end tests.
- Produce and verify a static frontend build for PHP-only hosting.
- Run integration tests against a real staging MySQL database.

Do not deploy to the production host until these checks pass. The original source archive must remain preserved unchanged.


## Handoff for AI coding assistants

- Start here: [Persian project handoff](AI_HANDOFF_FA.md)
- Agent rules: [AGENTS.md](AGENTS.md)
- Current work and test status: [Phase 2 backlog](docs/phase-2-backlog.md)

Important: this branch is a migration workspace, **not a complete source backup or deployable release**. The full source archive and PHP backend still need to be transferred and verified.