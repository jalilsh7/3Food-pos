# Frontend Shared Layer

## مسئولیت
قرارداد API client، primitiveهای UI، form controls، data table و توکن‌های مشترک.

## قواعد وابستگی
shared نباید feature-specific باشد و نباید از `features/*` import کند. Featureها می‌توانند shared/api و shared/ui را مصرف کنند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/shared`. تست API error handling, request ID, CSRF, form controls و accessibility primitives لازم است؛ فعلاً تست مستقل در tree وجود ندارد.


## وضعیت تست فعلی
تست معماری این بخش در `v3/frontend/tests/architecture.test.mjs` تعریف شده است؛ زیرآزمون مربوط به shared مرزبندی importها را بررسی می‌کند. تست‌های رفتاری/تعامل کاربر هنوز ایجاد یا اجرا نشده‌اند.
