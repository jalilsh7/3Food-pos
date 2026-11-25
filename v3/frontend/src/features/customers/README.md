# Customers Feature

## مسئولیت
جست‌وجو و مدیریت اطلاعات مشتری و تاریخچه مرتبط با مشتری.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`؛ coupling مستقیم با POS یا Orders ممنوع است.

## Backend contract
Customers/Catalog API؛ اطلاعات شخصی باید حداقلی و بر اساس permission نمایش داده شود.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/customers`. تست جست‌وجو، empty state، permission و privacy لازم است؛ فعلاً وجود ندارد.


## وضعیت تست فعلی
تست معماری این بخش در `v3/frontend/tests/architecture.test.mjs` تعریف شده است؛ زیرآزمون مربوط به customers مرزبندی importها را بررسی می‌کند. تست‌های رفتاری/تعامل کاربر هنوز ایجاد یا اجرا نشده‌اند.
