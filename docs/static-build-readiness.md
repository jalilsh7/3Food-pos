# بررسی مسیر Build مستقل برای استقرار PHP/MySQL

تاریخ بررسی: 2026-11-17 (به‌روزرسانی پس از افزودن fallback cPanel)

## وضعیت تازه

- فایل `php-backend/public/.htaccess` ابتدا درخواست‌های `/api/...` را به front controller PHP می‌فرستد و سپس، فقط در صورت وجود `DOCUMENT_ROOT/index.html`، مسیرهای غیرواقعی را به SPA fallback می‌کند.
- دستور مستقل `npm run build:cpanel` اضافه شده است. در حالت `--mode cpanel`، پیکربندی Vite حالت رسمی SPA در TanStack Start را فعال می‌کند، خروجی shell را `index.html` قرار می‌دهد و Nitro را با preset `static` اجرا می‌کند تا pipeline prerender متادیتای build لازم را داشته باشد، اما خروجی عمومی استاتیک باشد و server bundle مربوط به Node تولید نشود؛ دستور build قدیمی و dev برای سایر محیط‌ها تغییر نکرده‌اند.
- workflow CI اکنون build مخصوص cPanel را نیز اجرا می‌کند. تا پایان اجرای workflow، موفقیت build را تأییدشده تلقی نکنید.
- تست رگرسیون `scripts/cpanel-htaccess.test.mjs` ترتیب API و fallback و شرط‌های محافظ را بررسی می‌کند؛ این تست به مجموعه `scripts/**/*.test.mjs` موجود اضافه شده است.
- اجرای CI پس از این تغییرات باید جداگانه تأیید شود؛ تست متنی rewrite جایگزین آزمون Apache واقعی نیست.

## نتیجه اجرایی

مسیر اختصاصی build استاتیک اکنون اضافه شده، اما هنوز باید در CI اثبات شود و وابستگی‌های server function/connector که در سورس باقی مانده‌اند باید بررسی شوند. اضافه‌شدن دستور build به‌تنهایی به معنی آماده‌بودن خروجی برای cPanel نیست.

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

مسیر static build هنوز باید با جداسازی ورودی client از TanStack Start/Nitro و حذف وابستگی‌های runtime سمت سرور از bundle پیاده‌سازی شود. سپس auth و داده‌ها باید فقط از PHP API در مرورگر مصرف شوند، خروجی build در مسیر root و زیرمسیر `/pos-staging/` آزمایش شود و در نهایت روی Apache واقعی تست شود. ایجاد build استاتیک صوری پیش از این انتقال توصیه نمی‌شود.

اجرای نخست build نشان داد TanStack Start برای prerender از اطلاعات preview مربوط به Nitro استفاده می‌کند؛ بنابراین build cPanel با preset `static` پیکربندی شده است. نتیجه واقعی این اصلاح فقط از اجرای CI مربوط به commit `d16ac5d` قابل اعلام است.
