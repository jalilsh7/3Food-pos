# Settings Feature

## مسئولیت
تنظیمات کسب‌وکار و شعبه و کنترل گزینه‌های قابل پیکربندی.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`. feature settings نباید مجوزها را صرفاً در UI enforce کند؛ backend باید enforce کند.

## Backend contract
Settings/Access API؛ secrets باید masked باشند و هیچ secret در local storage یا log ذخیره نشود.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/settings`. تست save/load، permission، validation و secret masking لازم است؛ فعلاً وجود ندارد.
