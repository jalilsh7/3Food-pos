# راهنمای تحویل و ادامه توسعه 3Food POS

آخرین بازبینی: 2026-11-18  
مخزن: `jalilsh7/3Food-pos`  
شاخه پایه: `migration/php-mysql`  
شاخه پاک‌سازی مستقل: `cleanup/remove-grok-dependencies`  
PR پاک‌سازی: https://github.com/jalilsh7/3Food-pos/pull/1

> این سند وضعیت فعلی را خلاصه می‌کند؛ قبل از هر تغییر، شاخه و آخرین commit را از GitHub بررسی کنید. وجود کد یا build در GitHub به معنی استقرار روی هاست نیست.

## 1) هدف و الزامات مالک

ساخت POS مستقل 3Food روی `pos.3food.ir` با رابط React و بک‌اند PHP/MySQL برای استفاده چنددستگاهی.

الزامات قطعی:
- ورود همه کاربران با username/password و احراز هویت واقعی سمت سرور.
- نقش‌ها: `manager`، `cashier`، `kitchen` و کنترل مجوزها در PHP.
- مدیر اولیه فقط با setup token امن و یک‌بارمصرف ساخته شود؛ ثبت‌نام عمومی وجود نداشته باشد.
- MySQL منبع حقیقت داده‌های عملیاتی باشد؛ localStorage/sessionStorage محل نگهداری رمز، session ID، setup token، CSRF یا API secret نیست.
- ثبت سفارش، قیمت‌گذاری، تخفیف، مالیات، موجودی، امتیاز و idempotency در سمت سرور و در تراکنش امن انجام شوند.
- پیامک فقط با تنظیم خصوصی سرور و به‌صورت opt-in فعال شود.
- بکاپ/بازیابی، گزارش‌ها، سفارش‌ها، انبار، مشتریان و گردش آشپزخانه حفظ شوند.
- پیش از انتشار اصلی، staging و تست end-to-end واقعی الزامی است.

## 2) معماری فعال cPanel

- فرانت‌اند: React 19 + TypeScript + Vite + TanStack Router؛ ورودی مرورگر `src/main.tsx` و پوسته استاتیک `index.html`.
- بک‌اند: PHP API در `php-backend/public/api/index.php` با مسیر same-origin زیر `/api/v1`.
- دیتابیس عملیاتی: MySQL.
- احراز هویت: session سمت PHP با cookie امن HttpOnly؛ CSRF در حافظه کلاینت نگهداری می‌شود.
- build قابل استقرار: `npm run build:cpanel`؛ بسته ترکیبی در `dist-cpanel/` تولید می‌شود.
- هاست مقصد cPanel/LiteSpeed با PHP 8.2 و MySQL است؛ Node فقط در محیط build/CI لازم است.

در build فعال cPanel نباید runtime یا اتصال به Grok، App Builder، PreviewHostBridge، OAuth broker، TanStack Start/Nitro server، PostgreSQL یا PGLite وارد bundle مرورگر شود. هیچ script، stylesheet یا فونت از CDN خارجی بارگیری نشود.

## 3) وضعیت شاخه پاک‌سازی

شاخه `cleanup/remove-grok-dependencies` بر پایه `migration/php-mysql` ساخته شده و PR شماره 1 باز است؛ این شاخه هنوز merge نشده است.

تغییرات پاک‌سازی موجود:
- کدهای متروک Better Auth، OAuth broker/Grok، PGLite/PostgreSQL، TanStack Start server functions و App Builder connector از سورس حذف شده‌اند؛ این مسیرها متعلق به معماری قدیمی بودند و از entrypoint فعال React/PHP استفاده نمی‌شدند.
- migration قدیمی Better Auth و تست‌های مرتبط با app-data/auth حذف شده‌اند؛ قرارداد احراز هویت فعلی PHP session و MySQL است.
- وابستگی‌های مستقیم `@electric-sql/pglite`, `@tanstack/react-start`, `better-auth`, `jose`, `kysely`, `nitro`, `pg` و `@types/pg` از manifest حذف شده‌اند.
- lockfile باید توسط workflow مخصوص PR با npm بازتولید شود؛ تا پایان اجرای آن، `package-lock.json` را synchronized فرض نکنید.
- تست TypeScriptهای حذف‌شده‌ی ماژول‌های قدیمی از script تست خارج شده‌اند؛ تست‌های مستقل PHP/API و اسکریپت‌های فعال حفظ شده‌اند.
- حذف فایل‌ها و افزونه‌های PWA/Preview وابسته به Grok و نشانگرهای مربوط به آن‌ها.
- حذف shell مخصوص TanStack Start از route ریشه‌ی SPA.
- حذف ارجاع routeTree به مسیر ناموجود `/api/sms` و حذف type registration قدیمی TanStack Start از routeTree.
- افزودن ممیزی زنجیره import واقعی مرورگر پیش از build.
- افزودن ممیزی خروجی تولیدشده برای نشانگرهای Grok/App Builder و assetهای HTML/CSS از راه دور.
- بازنویسی `AGENTS.md`؛ دستورالعمل قدیمی App Builder/Grok با معماری واقعی cPanel جایگزین شده است.
- دستور `build:cpanel` اکنون ممیزی source graph، build، ممیزی خروجی و بسته‌بندی را پشت سر هم اجرا می‌کند.

**محدودیت مهم:** بخشی از فایل‌های legacy شامل Better Auth، OAuth قدیمی، TanStack Start server helpers، app-data connector و PostgreSQL/PGLite هنوز در مخزن باقی است. آن‌ها از entrypoint فعال مرورگر وارد نمی‌شوند، اما حذف کامل فایل‌ها و وابستگی‌های package هنوز انجام و تأیید نشده است. قبل از حذف، import graph کامل، اسکریپت‌های تست، tsconfig و lockfile باید بررسی شوند.

## 4) وضعیت فنی و موارد باقی‌مانده

- فرم ورود PHP در `src/components/grill/app.tsx` هنگام تایپ فقط state محلی React را تغییر می‌دهد؛ درخواست شبکه فقط هنگام submit اجرا می‌شود. بنابراین هنگ‌کردن مرورگر با تایپ هنوز ریشه‌یابی قطعی نشده و نباید با حدس به فرم نسبت داده شود.
- API health و auth/me در هاست قبلاً پاسخ داده‌اند؛ نشست کاربر در وضعیت unauthenticated و setup در وضعیت setup_required بوده است.
- بررسی قبلی مرورگر نشان داده بود CPU در اجرای JavaScript مصرف می‌شود، اما source map در دسترس نبود. تست مرورگر واقعی بعد از build مستقل هنوز لازم است.
- وضعیت داده‌ها و عملیات چنددستگاهی باید با بررسی کد فعلی و تست MySQL واقعی تأیید شود؛ polling دوره‌ای به‌تنهایی اثبات همگام‌سازی کامل نیست.
- باید build، typecheck، unit tests، lint، PHP syntax، API integration و browser smoke روی commit نهایی موفق شوند.
- باید روی staging واقعی، ورود، ساخت مدیر، نقش‌ها، ثبت سفارش، هم‌زمانی، موجودی، تخفیف، بکاپ/بازیابی و SMS تست شوند.
- نسخه production هاست نباید بدون تأیید مالک و backup دستکاری شود.

## 5) قواعد امنیت و استقرار

- هرگز از مالک `private/config.php`، setup token، app_key، رمز دیتابیس یا session cookie نخواهید.
- `private/config.php` باید خارج از Document Root و خارج از Git بماند.
- secrets را در source، ZIP عمومی، logs یا مستندات قرار ندهید.
- هیچ تغییری در دیتابیس یا فایل‌های زنده cPanel بدون مجوز صریح و برنامه rollback انجام نشود.
- build موفق معادل تست واقعی Apache/PHP/MySQL یا تأیید آمادگی production نیست.
- هر گزارش باید بین «تغییر در GitHub»، «تست موفق»، «ساخت artifact» و «استقرار روی هاست» تفکیک قائل شود.

## 6) روال ادامه کار

1. وضعیت PR و آخرین commit شاخه پاک‌سازی را بررسی کنید.
2. CI را تا پایان دنبال کنید و هر خطا را در کد اصلاح کنید؛ تا وقتی سبز نشده، ادعای موفقیت نکنید.
3. ممیزی import graph را کامل کنید و فقط فایل‌های legacy اثبات‌شده‌ی بدون مصرف را حذف کنید.
4. وابستگی‌های بلااستفاده را با lockfile به‌روز حذف کنید؛ هیچ dependency صرفاً با حدس حذف نشود.
5. پس از هر تغییر، typecheck، تست، lint و `npm run build:cpanel` را اجرا کنید.
6. تست مرورگر واقعی را روی artifact نهایی اجرا کنید و مسیر تایپ در فیلدهای ورود را نیز بررسی کنید.
7. artifact را فقط پس از موفقیت کامل CI به‌عنوان خروجی آماده staging معرفی کنید.
8. استقرار cPanel و تست عملیاتی را جداگانه و فقط با اجازه مالک انجام دهید.

## 7) فایل‌های مرجع

- `AGENTS.md`: دستورالعمل معماری cPanel و امنیت.
- `README.md`: خلاصه پروژه و وضعیت انتشار.
- `IMPLEMENTATION-STATUS-FA.md`: قابلیت‌ها و backlog.
- `SOURCE-AUDIT-PHP-MYSQL-FA.md` و `docs/*`: گزارش‌های تاریخی؛ تاریخ و زمینه هر گزارش را در نظر بگیرید.
- `src/lib/api/php-client.ts`: قرارداد کلاینت PHP API.
- `php-backend/README-FA.md`: راهنمای backend و نصب.
- `scripts/audit-cpanel-source.mjs`: ممیزی import graph مرورگر.
- `scripts/audit-cpanel.mjs`: ممیزی bundle تولیدشده.
