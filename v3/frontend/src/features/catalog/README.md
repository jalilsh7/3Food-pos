# Catalog Feature

## مسئولیت
مدیریت دسته‌ها، محصولات، variantها و optionها.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`؛ از featureهای دیگر import نکند.

## Backend contract
Catalog API؛ داده و مجوزها از backend می‌آیند و feature نباید منطق قیمت/مالیات authoritative را محاسبه کند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/catalog`. تست فرم‌ها، validation، pagination و خطاهای API لازم است؛ فعلاً وجود ندارد.


## وضعیت تست فعلی
تست معماری این بخش در `v3/frontend/tests/architecture.test.mjs` تعریف شده است؛ زیرآزمون مربوط به catalog مرزبندی importها را بررسی می‌کند. تست‌های رفتاری/تعامل کاربر هنوز ایجاد یا اجرا نشده‌اند.
