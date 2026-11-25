# Support Module

## مسئولیت
قراردادهای cross-cutting کوچک مانند logging و خواندن configuration/environment.

## ورودی‌ها و قراردادها
- `Logger` interface.
- پیاده‌سازی log در `Infrastructure/Logging/ErrorLogLogger`.

## وابستگی‌های مجاز
Support باید از ماژول‌های دامنه‌ای مستقل بماند و نباید به PDO، HTTP Controller یا business service وابسته شود.

## Migrationها
ندارد.

## تست مستقل
مسیر هدف: `v3/backend/tests/Modules/Support`. تست JSON output، module filter، request correlation و redaction لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
فیلتر ماژول با `POS_V3_LOG_MODULES` تنظیم می‌شود؛ خالی بودن آن همه ماژول‌ها را فعال می‌کند.


## Application error contract
`ApplicationException` خطای transport-neutral برای use-caseهاست؛ `HttpException` subclass آن برای سازگاری adapterهای HTTP باقی مانده و Kernel خطای پایه را map می‌کند.
تست مستقل معماری: `v3/backend/tests/Modules/Support/ArchitectureTest.php`.

## Application errors
`ApplicationException` قرارداد خطای use-caseهاست؛ Kernel آن را به پاسخ HTTP تبدیل می‌کند.
