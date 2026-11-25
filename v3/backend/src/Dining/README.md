# Dining Module

## مسئولیت
محدوده‌های پذیرایی، میزها و نشست‌های میز و ارتباط آن‌ها با سفارش.

## ورودی‌ها و قراردادها
- HTTP adapter: `DiningController`.
- Application service: `DiningService`.
- Persistence port: `DiningStore`; adapter: `Infrastructure/Database/DiningRepository`.

## وابستگی‌های مجاز
سرویس فقط به `DiningStore`، idempotency و audit وابسته است. قواعد business/branch باید در تمام queryها اعمال شوند؛ PDO و SQL در Infrastructure می‌مانند.

## Migrationها
008 مالک مشترک Orders/Dining است؛ جدول‌های dining در manifest با owner اصلی Orders ثبت شده‌اند و تغییرات اختصاصی بعدی می‌توانند owner=Dining داشته باشند.

## تست مستقل
مسیر هدف: `v3/backend/tests/Modules/Dining`. تست table capacity، open/close session، branch scope، concurrent session و idempotency لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
تغییر نشست میز و ارتباط آن با سفارش باید audit شود؛ خطاها با module=dining ثبت شوند.

## Application API contract
`DiningApplication` defines the public dining use-case signatures; the HTTP controller depends on this interface.
