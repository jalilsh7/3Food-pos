# Finance Feature

## مسئولیت
نمایش صندوق، session صندوق، دریافت/پرداخت و هزینه‌ها.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`. منطق محاسبه مانده authoritative در backend است.

## Backend contract
Finance API؛ مبالغ integer تومان و تبدیل نمایش فقط در UI انجام می‌شود.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/finance`. تست نمایش مبالغ، open/close session، permission و error states لازم است؛ فعلاً وجود ندارد.
