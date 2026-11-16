# بررسی مسیر Build مستقل برای استقرار PHP/MySQL

تاریخ بررسی: 2026-11-17

## نتیجه اجرایی

در وضعیت فعلی نمی‌توان فقط با تغییر یک دستور Vite، پروژه را به یک خروجی استاتیک قابل استقرار روی cPanel تبدیل کرد. سورس اصلی هنوز به قابلیت‌های runtime سمت سرور TanStack Start متکی است.

## شواهد از سورس

- `vite.config.ts` پلاگین‌های `tanstackStart()` و `nitro()` را فعال می‌کند؛ Nitro با preset مربوط به Vercel تنظیم شده است.
- `src/routes/__root.tsx` از `Scripts` و `HeadContent` متعلق به TanStack Router استفاده می‌کند و `AuthProvider` را در ریشه برنامه قرار می‌دهد.
- `src/lib/app-data/readiness.ts` از `createServerFn` استفاده می‌کند و handler آن به ماژول `.server.ts` متکی است.
- `src/lib/auth/middleware.ts` از middleware سمت سرور TanStack Start استفاده می‌کند.
- `src/lib/db.ts` صراحتاً server-only است و دیتابیس runtime را مدیریت می‌کند.
- دستور فعلی `npm run build` پس از `vite build`، دستور `npm run db:migrate` را اجرا می‌کند؛ اسکریپت مهاجرت Node بخشی از مسیر build است.
- store اصلی `src/lib/pos/store.ts` هنوز از Zustand `persist` استفاده می‌کند؛ در نتیجه داده POS هنوز منبع حقیقت MySQL ندارد.

## تصمیم فنی پیشنهادی

پیش از فعال‌کردن build استاتیک باید مرز کلاینت/سرور به‌صورت صریح بازطراحی شود:

1. مسیرهای ورود، نشست، CSRF و مجوزها فقط از PHP API استفاده کنند.
2. تمام عملیات POS از یک API client مرورگر به PHP منتقل شود؛ هیچ secret یا منطق اعتمادپذیر در bundle قرار نگیرد.
3. loaderها و `createServerFn`های وابسته به runtime یا به درخواست‌های fetch هم‌مبدأ تبدیل شوند یا با پیاده‌سازی client-safe جایگزین شوند.
4. مسیرهای runtime غیرضروری TanStack Start، Nitro، Vercel، Better Auth و PGlite از مسیر build/استقرار جدا شوند؛ حذف dependency فقط پس از اثبات عدم استفاده مجاز است.
5. یک ورودی build اختصاصی استاتیک تعریف شود و خروجی واقعی آن با مسیر زیرپوشه `/pos-staging/` آزمایش شود؛ assetها و route fallback باید زیرپوشه را درست پشتیبانی کنند.
6. `npm run build` نباید هیچ اتصال یا مهاجرت دیتابیس runtime انجام دهد. اجرای schema باید به مرحله نصب PHP و با ابزار نصب امن و کنترل‌شده منتقل شود.

## ریسک‌های مانع انتشار

- صرفاً خاموش‌کردن Nitro یا حذف `tanstackStart()` احتمالاً importها و server functions را می‌شکند.
- تغییر مسیر build بدون انتقال کامل احراز هویت و داده‌ها می‌تواند رابط کاربری را ظاهراً اجرا کند، در حالی که ثبت سفارش و نشست کار نمی‌کنند.
- build و typecheck هنوز در این محیط تأیید نشده‌اند؛ node_modules نصب نیست و دسترسی npm قبلاً محدود بوده است.
- هیچ deploy به دامنه اصلی یا staging نباید قبل از build موفق و تست API با MySQL واقعی انجام شود.

## گام بعدی

گام بعدی کدنویسی باید طراحی و پیاده‌سازی API client سمت مرورگر و قرارداد داده‌ای مشترک با PHP باشد؛ سپس auth/store به‌صورت تدریجی به آن منتقل شوند. ایجاد یک build استاتیک صوری پیش از این انتقال توصیه نمی‌شود.

این سند گزارش بررسی است و ادعای پیاده‌سازی یا تست موفق ندارد.
