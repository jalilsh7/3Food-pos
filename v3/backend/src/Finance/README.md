# Finance Module

## مسئولیت
صندوق‌ها، session صندوق، دریافت/پرداخت نقدی، پرداخت‌ها، برگشت و هزینه‌ها.

## ورودی‌ها و قراردادها
- HTTP adapter: `CashRegisterController`.
- Application service: `CashRegisterService`.
- Persistence port: `CashStore`; adapter: `Infrastructure/Database/CashRepository`.

## وابستگی‌های مجاز
سرویس به `CashStore`، `IdempotencyService` و `AuditLogService` وابسته است. واحد مبلغ و قواعد ledger باید در مرز ماژول مستند شوند؛ درگاه آنلاین فقط در storefront order flow قرار می‌گیرد، نه صندوق حضوری.

## Migrationها
009 مالک Finance است؛ جداول payment/cash/expense در manifest ثبت شده‌اند.

## تست مستقل
مسیر هدف: `v3/backend/tests/Finance`. تست opening/closing balance، cash movement، duplicate payment، refund، expense scope و audit لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
تغییر مانده صندوق و عملیات مالی باید audit append-only داشته باشد؛ log شامل PAN، credentials یا داده پرداخت خام نباشد.
