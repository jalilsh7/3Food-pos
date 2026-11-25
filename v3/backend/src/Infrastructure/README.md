# Infrastructure Layer

## مسئولیت
پیاده‌سازی adapterهای فنی: PDO connection/repositories، SQL transaction manager، structured logging sink و private media storage.

## اجزای اصلی
- `Database/`: Repositoryهای PDO و `TransactionManager`.
- `Logging/ErrorLogLogger`: JSON logger با module filter و redaction.
- `Storage/PrivateMediaStorage`: ذخیره‌سازی فایل خارج از web root.

## قواعد وابستگی
Infrastructure می‌تواند interfaceهای Auth/Catalog/Orders/Inventory/Finance/Media/Security را پیاده‌سازی کند. Application و HTTP نباید concrete Infrastructure را بسازند؛ ساخت adapterها فقط در Composition Root مجاز است.

## Migrationها
DDL و runner در `database/v3` نگهداری می‌شوند؛ Repositoryها مالک schema نیستند.

## تست مستقل
مسیر هدف: `v3/backend/tests/Modules/Infrastructure`. تست PDO adapter، transaction rollback/commit، migration runner، checksum، lock، storage permissions و log sink لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات
اتصال PDO باید singleton در Composition Root باشد تا تمام Repositoryها و TransactionManagerهای یک درخواست روی connection مشترک باشند. فایل‌های private خارج از public document root بمانند.
