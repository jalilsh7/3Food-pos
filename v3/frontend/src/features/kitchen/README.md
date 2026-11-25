# Kitchen Feature

## مسئولیت
نمایش سفارش‌های در انتظار آماده‌سازی و تغییر وضعیت‌های مجاز آشپزخانه.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`. feature نباید مستقیماً به POS یا Orders component import داشته باشد.

## Backend contract
Orders API؛ transitionهای وضعیت باید در backend مجازسنجی شوند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/kitchen`. تست ترتیب، refresh، status transition و reconnect لازم است؛ فعلاً وجود ندارد.
