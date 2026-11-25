# Storefront Feature

## مسئولیت
پیش‌نمایش و مدیریت قالب سفارش اینترنتی و نمایش منوی عمومی.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`. checkout عمومی باید قرارداد مستقل و actor مهمان واقعی داشته باشد؛ نباید user داخلی جعلی بسازد.

## Backend contract
Public Storefront API در مرحله بعد؛ business/branch از resolver سمت سرور و قیمت/هزینه/موجودی از backend تعیین می‌شوند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/storefront`. تست guest order, menu filtering, business hours, delivery/pickup و payment state لازم است؛ فعلاً وجود ندارد.


## وضعیت تست فعلی
تست معماری این بخش در `v3/frontend/tests/architecture.test.mjs` تعریف شده است؛ زیرآزمون مربوط به storefront مرزبندی importها را بررسی می‌کند. تست‌های رفتاری/تعامل کاربر هنوز ایجاد یا اجرا نشده‌اند.
