# Catalog Module

## مسئولیت
دسته‌بندی، محصول، SKU، variant، option group و اتصال گزینه‌ها به محصول.

## ورودی‌ها و قراردادها
- HTTP adapter: `CatalogController`.
- Application service: `CatalogService`.
- Persistence port: `CatalogStore`; adapter: `Infrastructure/Database/CatalogRepository`.

## وابستگی‌های مجاز
سرویس به `CatalogStore`، `IdempotencyService` و `AuditLogService` وابسته است. SQL، PDO و transaction implementation متعلق به Infrastructure است. پاسخ عمومی storefront باید DTO محدودشده داشته باشد و نباید raw repository response را منتشر کند.

## Migrationها
006 مالک اصلی Catalog/Customers؛ 007 مالک Catalog برای variants/options.

## تست مستقل
مسیر هدف: `v3/backend/tests/Catalog`. پوشش uniqueness، business scope، inactive products، variants/options، idempotency و عدم نشت فیلدهای داخلی لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
تغییرات create/update/archive باید audit شوند؛ logها نباید token یا اطلاعات حساس مشتری را ثبت کنند.
