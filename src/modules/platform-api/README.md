# Platform API boundary

The existing PHP client remains the compatibility façade while its implementation is migrated incrementally.

## Layer ownership
- contracts: response envelopes, request options, diagnostic context.
- transport: same-origin request policy and request correlation helpers.
- session: in-memory CSRF lifecycle only; no browser storage.
- resource adapters: feature-specific API methods remain on the legacy façade until migrated.
- backend: PHP route/auth/domain handling remains authoritative.

## Migration guardrails
- Preserve public `phpApi` method signatures during staged extraction.
- Never log bodies, credentials, CSRF, or provider responses.
- Remove query strings before recording request actions.
- Keep requests same-origin, cookie-authenticated, cache-disabled and CSRF-protected where mutating.
- Avoid importing feature/UI code into platform API.
- Tests and build are intentionally deferred to final project verification.

## Progress
The contract, transport policy, correlation helper, and CSRF state are separated as foundational adapters. The compatibility client has not yet been rewired to these helpers; that integration is a subsequent grouped step.
