# Inventory Feature

## مسئولیت
نمایش موجودی، تامین‌کننده‌ها، اسناد انبار و عملیات posting.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`; ماژول نباید منطق ledger را در browser پیاده‌سازی کند.

## Backend contract
Inventory API؛ موجودی و posting از سرور authoritative هستند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/inventory`. تست draft/post, validation, branch scope و failure states لازم است؛ فعلاً وجود ندارد.
