# Auth Feature

## مسئولیت
صفحه ورود و انتخاب business/branch context.

## وابستگی‌ها
فقط `shared/api`، `shared/ui` و asset/CSS محلی. هیچ feature دیگری را import نکند.

## Backend contract
Auth/Access API؛ session cookie، CSRF و business context از API دریافت می‌شوند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/auth`. تست login/logout، expired session، branch switching و validation لازم است؛ فعلاً وجود ندارد.
