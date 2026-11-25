# Orders Feature

## مسئولیت
مرکز سفارش‌ها، جست‌وجو، جزئیات، وضعیت و fulfillment.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`. محاسبه مبلغ و دسترسی authoritative در backend باقی می‌ماند.

## Backend contract
Orders API؛ request_id و idempotency key برای عملیات حساس حفظ شوند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/orders`. تست filtering، detail, status transitions، pagination و retry لازم است؛ فعلاً وجود ندارد.


## وضعیت تست فعلی
تست معماری این بخش در `v3/frontend/tests/architecture.test.mjs` تعریف شده است؛ زیرآزمون مربوط به orders مرزبندی importها را بررسی می‌کند. تست‌های رفتاری/تعامل کاربر هنوز ایجاد یا اجرا نشده‌اند.
