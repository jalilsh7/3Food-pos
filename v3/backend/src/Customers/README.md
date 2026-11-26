# Customers Module

## مسئولیت
مالک پروفایل مشتری، شماره تماس، consent و شناسه‌های عمومی مشتری؛ تاریخچه سفارش از Orders query contract خوانده می‌شود و مالکیت سفارش منتقل نمی‌شود.

## قراردادهای مورد انتظار
`CustomerApplication`, `CustomerStore`, `CustomerPublicView`. شماره تماس و داده شخصی فقط در scope مجاز نمایش داده می‌شود.

## وابستگی‌ها
از Orders فقط query/event contract مصرف می‌شود؛ direct repository access ممنوع. Catalog نباید customer profile را مدیریت کند.

## Migration / Tests
Migrationهای موجود 006 به‌صورت اولیه جدول مشتری را ایجاد می‌کند؛ مالکیت نهایی Customers در migration manifest باید با migration forward مشخص شود. تست مستقل هدف: `v3/backend/tests/Modules/Customers` برای consent، duplicate phone، privacy و business isolation.
