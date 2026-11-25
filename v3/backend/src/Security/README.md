# Security Module

## مسئولیت
قراردادهای idempotency، transaction boundary، audit write/read، login throttling و guardهای امنیتی مشترک.

## ورودی‌ها و قراردادها
- Ports: `IdempotencyStore`, `TransactionBoundary`, `AuditLogWriter`, `AuditLogReader`, `LoginAttemptStore`.
- Services: `IdempotencyService`, `AuditLogService`, `LoginAttemptLimiter`.
- SQL adapters در `Infrastructure/Database`.

## وابستگی‌های مجاز
Application serviceها فقط interfaceها را می‌شناسند. PDO و lock/query implementationها در Infrastructure هستند. idempotency record و عملیات دامنه باید از یک PDO singleton و transaction مشترک استفاده کنند.

## Migrationها
002 login attempts، 004 idempotency keys، 005 audit business scope.

## تست مستقل
مسیر هدف: `v3/backend/tests/Modules/Security`. تست replay/conflict, encryption, expiration, audit append-only, redaction و throttling لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
log مرکزی JSON دارای module و request_id است؛ کلیدهای password/token/secret/authorization/cookie/apiKey/credential باید redact شوند.


## قراردادهای مشترک جدید
- `BusinessScopeContext` برای مصرف scope توسط ماژول‌های مختلف؛ `Auth/BusinessScope` و `Security/BusinessContext` هر دو آن را پیاده‌سازی می‌کنند.
- `ActorContext`, `BusinessContext`, `PermissionChecker` و `ApplicationException` قراردادهای کاربردی مشترک‌اند.
- `AuditLogService` رویداد audit را به Logger مرکزی با module و request_id متصل می‌کند.
- تست مستقل معماری: `v3/backend/tests/Modules/Security/ArchitectureTest.php`.
