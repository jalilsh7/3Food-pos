# وضعیت build استاتیک و بسته cPanel

تاریخ بررسی: 2026-11-17

## پیاده‌سازی انجام‌شده

- مسیر build مخصوص cPanel از TanStack Start/Nitro جدا شده است. در `vite.config.ts` برای `--mode cpanel` فقط Vite، React و `TanStackRouterVite` اجرا می‌شوند؛ build عادی/dev همچنان مسیر قبلی Start/Nitro را حفظ می‌کند.
- `src/main.tsx` ورودی client-only React Router را فراهم می‌کند و `index.html` پوسته استاتیک است.
- `src/routes/__root.tsx` اکنون محتوای route را از document shell جدا می‌کند؛ Start در مسیر قدیمی shell خودش را دارد و Vite SPA محتوای route را در `#root` رندر می‌کند.
- دستور `npm run build:cpanel` خروجی React را می‌سازد و سپس `scripts/package-cpanel.mjs` بسته ترکیبی تولید می‌کند:
  - `dist-cpanel/public/`: HTML، JS/CSS، assets، `.htaccess` و PHP API
  - `dist-cpanel/private/`: نمونه config و deny rule، بیرون Document Root
  - `dist-cpanel/database/`: schema و migrationهای MySQL
  - راهنمای فارسی نصب و manifest بسته
- فایل `php-backend/public/.htaccess` ابتدا API را route می‌کند و فقط پس از آن مسیرهای ناموجود را به `index.html` می‌فرستد؛ فایل‌های واقعی و پوشه‌ها دست‌نخورده می‌مانند.
- تست `scripts/cpanel-htaccess.test.mjs` ترتیب و شرط‌های rewrite را بررسی می‌کند.
- workflow CI پس از build، بسته `dist-cpanel/` را به‌صورت artifact با ماندگاری ۱۴ روز منتشر می‌کند.

## نتیجه CI

- build اولیه plain Vite برای cPanel روی commit `4556531a4be29884c278477cd2072d0caf9f5e65` موفق شد؛ خروجی شامل `dist/index.html` و bundleهای JS/CSS بود.
- اجرای کامل CI روی commit `d3632e38036d6002a6c38f713018ca367d69d8db` موفق شد: PHP syntax، TypeScript، تست‌ها، ESLint، build استاتیک، اعتبارسنجی ساختار بسته و upload artifact.
- artifact با نام `3food-pos-cpanel` در [اجرای GitHub Actions](https://github.com/jalilsh7/3Food-pos/actions/runs/44098838943) موجود است؛ حجم 471,264 بایت و مهلت نگهداری تا 2026-12-01.
- تست Apache واقعی، اتصال PDO/MySQL، ورود مدیر، سفارش هم‌زمان و SMS هنوز روی cPanel اجرا نشده‌اند.

## ساختار نصب روی cPanel

پس از دریافت artifact:
- Document Root زیردامنه باید روی پوشه `public` تنظیم شود.
- پوشه `private` باید sibling پوشه public و خارج از web root بماند.
- `private/config.example.php` را به `private/config.php` کپی و فقط روی سرور مقداردهی کنید.
- SQL داخل `database/` را با توجه به خالی/موجود بودن دیتابیس اجرا کنید.

هیچ config واقعی یا credential در artifact قرار نمی‌گیرد. build موفق به‌تنهایی به معنی آماده‌بودن انتشار عملیاتی نیست.

## موارد باقی‌مانده

- اتصال کامل همه عملیات UI و حذف Zustand persist به‌عنوان منبع حقیقت.
- تست end-to-end در مرورگر و تست Apache/cPanel با PHP 8.2 و PDO MySQL واقعی.
- آزمون تراکنش‌ها و هم‌زمانی با چند نشست واقعی روی MySQL.
- بکاپ/بازیابی و تست واقعی ارسال SMS.
- بررسی deploy روی root و مسیر staging در صورت استفاده از subpath.
