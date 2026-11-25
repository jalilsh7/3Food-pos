# SMS Module

This directory is the isolated application boundary for SMS functionality.

## Structure

- `manifest.ts`: stable module identity/version/capabilities for diagnostics and future registration.
- `index.ts`: the only public import surface for other application areas.
- `domain/`: event definitions and deterministic domain helpers; no UI or provider dependencies.
- `ui/`: React screens and interaction state.
- `application/` (next extraction): use-cases for sending, campaigns and template persistence.
- `infrastructure/` (next extraction): PHP API/provider adapters and persistence.
- `observability/` (next extraction): structured, redacted module diagnostics.

## Dependency rules

1. Other modules import SMS only through `src/modules/sms/index.ts`.
2. Domain code must not import React, browser APIs, PHP clients or UI components.
3. UI calls application use-cases; it must not implement provider protocols.
4. Provider credentials stay server-side. Never log API keys, tokens or full authorization headers.
5. Changes to persisted contracts require versioned PHP/MySQL migrations and backward-compatibility review.
6. Keep module tests beside the module; integration tests verify the public API and PHP boundary.

## Current extraction boundary

The SMS screen has been moved intact into `ui/` to preserve behavior. Event metadata and variable parsing are now in `domain/events.ts`. Sending orchestration remains in the POS application temporarily and is a tracked extraction task; do not duplicate it during the next refactor.
