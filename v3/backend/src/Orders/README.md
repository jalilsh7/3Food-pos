# Orders Module

## مسئولیت
ایجاد سفارش، اقلام و افزودنی‌ها، fulfillment، وضعیت سفارش و تاریخچه تغییر وضعیت.

## ورودی‌ها و قراردادها
- HTTP adapter: `OrderController`.
- Application service: `OrderService`.
- Persistence port: `OrderStore`; adapter: `Infrastructure/Database/OrderRepository`.
- Shared ports: `IdempotencyStore`, `TransactionBoundary`, `AuditLogWriter`.

## وابستگی‌های مجاز
سرویس سفارش PDO یا Repository concrete نمی‌سازد. تمام writeهای سفارش و پاسخ idempotency باید با همان PDO singleton در یک transaction boundary اجرا شوند. قیمت، tax، stock و business/branch scope از داده قابل اعتماد سمت سرور استخراج شوند.

## Migrationها
008 مالک اصلی Orders/Dining. تغییرات schema بعدی باید migration افزایشی با owner=Orders داشته باشند.

## تست مستقل
مسیر هدف: `v3/backend/tests/Orders`. تست totals، scope isolation، idempotency replay، concurrent order number، state transitions و audit الزامی است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
برای خطاها request_id و module=orders ثبت شود؛ payload کامل سفارش و اطلاعات شخصی در log نوشته نشود.
