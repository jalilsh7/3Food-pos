# Schema migration ownership and commercial capability/audit contract

## Migration policy
- Each schema change ships as a numbered migration with a stable identifier and checksum.
- Installer and migration runner track applied migration IDs and timestamps; duplicate execution is prevented.
- Each migration declares prerequisites and must be designed for explicit failure handling.
- Avoid destructive or irreversible schema/data changes without explicit approval and backup/recovery strategy.
- Fresh installation and upgrade paths must converge on the supported schema state.
- Keep customer data migrations separate from code deployment; preflight and maintenance policy required.
- Migration runner should not mark failed work as applied; preserve diagnostics with secrets redacted.
- Migration execution is tenant/customer installation scoped; central licensing service must not share customer transactional DB.

## Feature entitlements
- Feature access is resolved from plan/entitlement and local configuration, server-side.
- UI feature visibility is not enforcement; APIs must validate entitlement and permissions.
- Define defaults and graceful disabled-feature behavior; do not silently delete data when a feature is disabled.
- Plan limits are explicit and configurable, with safe validation at application boundary.

## Audit
- Capture actor, action, entity, scope, timestamp, request/correlation ID and appropriate change summary.
- Exclude secrets, raw tokens and unnecessary personal data.
- Audit records must not be casually edited/deleted from application workflows.
- Export and sensitive audit access are permissioned.

## Status
Contract documented only. Existing schema and runner require detailed implementation review, compatibility work and deferred final tests.
