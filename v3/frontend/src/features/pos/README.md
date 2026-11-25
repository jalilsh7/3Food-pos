# POS Feature

## مسئولیت
رابط صندوق حضوری و ساخت سفارش از کاتالوگ و انتخاب‌های کاربر.

## وابستگی‌ها
فقط `shared/api` و `shared/ui`. POS نباید repository یا API transport داخلی feature دیگر را import کند.

## Backend contract
Catalog و Orders API؛ قیمت، مالیات، موجودی و تخفیف نهایی از backend محاسبه می‌شوند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/features/pos`. تست cart state، submit idempotency، unavailable stock warnings و recovery لازم است؛ فعلاً وجود ندارد.
