# دستورالعمل مخزن 3Food POS

## تفکیک نسخه‌ها
- V2 برنامه POS عملیاتی مورد نگهداری در این شاخه است؛ frontend در `src/`، backend در `php-backend/` و تست/ابزارها در `scripts/` قرار دارند.
- V3 پروژه‌ای مستقل است: کد در `v3/`، دیتابیس در `database/v3/` و مستندات در `v3/docs/`.
- هرگز کد، schema، migration، dependency یا workflow مخصوص V3 را وارد بسته V2 نکن.
- راهنمای جاری V2: `docs/v2/README-FA.md`، `STATUS-FA.md`، `OPERATIONS-FA.md` و `AI-HANDOFF-FA.md`.

## معماری V2
- Frontend: React + TypeScript + Vite + TanStack Router، خروجی SPA استاتیک.
- Backend: PHP API هم‌مبدأ در `php-backend/public/api`.
- Database: MySQL/InnoDB؛ مرجع داده عملیاتی سرور است.
- استقرار هدف cPanel/LiteSpeed؛ Node فقط برای build/CI لازم است.
- احراز هویت با نشست PHP و مجوز سمت سرور است؛ secret/session/CSRF/setup token در browser storage ذخیره نشود.

## کیفیت و تست
- نصب تکرارپذیر: `npm ci`
- بررسی‌ها: `npm run typecheck`، `npm test`، `npm run lint` و `npm run build:cpanel`
- تغییر PHP باید syntax و API/MySQL integration checks را بگذراند.
- هیچ تست یا deploy اجرا نشده‌ای را موفق اعلام نکن.
- مسیرها و importها را پیش از حذف/انتقال فایل ردیابی کن.

## دامنه محصول و ایمنی
- نیاز فروشگاه یک صندوق است؛ چندصندوقی در محدوده V2 نیست.
- نقش‌های manager، cashier و kitchen و محدودیت دسترسی در PHP حفظ شوند.
- منطق سفارش، مالی، تخفیف، مالیات، موجودی و وفاداری باید سمت سرور و تراکنشی باشد.
- پیامک اختیاری، سمت سرور و با credential خصوصی است.
- پشتیبانی واقعی کارتخوان فقط پس از درایور معتبر PSP و تست دستگاه قابل اعلام است.
- backup/restore، idempotency، audit و تراکنش‌های موجودی را تضعیف نکن.

## امنیت و استقرار
- هرگز config خصوصی، credential، setup token یا رمز دیتابیس را commit نکن.
- `private/config.php` خارج از Document Root بماند.
- به هاست و دیتابیس production دست نزن؛ استقرار فقط با تأیید مالک، backup و rollback plan مجاز است.
- CI موفق جایگزین staging cPanel/LiteSpeed و پذیرش عملیاتی نیست.
