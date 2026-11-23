# وضعیت build مستقل و بسته cPanel

آخرین بازبینی مستند: 2026-11-23  
شاخه فعال توسعه: `feature/3food-pos-next-release-v2`  
سابقه پاک‌سازی پلتفرم: شاخه `cleanup/remove-grok-dependencies` و PR #1 (تاریخی)

## معماری build

- Frontend: React + TypeScript + Vite + TanStack Router به‌صورت SPA استاتیک.
- Backend: PHP API در `public/api` با مسیر same-origin زیر `/api/v1`.
- Database: MySQL/InnoDB.
- هاست cPanel فقط به PHP و MySQL نیاز دارد؛ Node فقط در مرحله build/CI استفاده می‌شود.
- runtime هیچ وابستگی به Grok/App Builder، Better Auth، TanStack Start/Nitro، PostgreSQL/PGLite، preview-host identity یا اسکریپت‌های تزریقی ندارد.

## کنترل‌های build

دستور `npm run build:cpanel` به‌ترتیب:
1. زنجیره import واقعی مرورگر را بررسی می‌کند و ورود ماژول سروری، import محلی گمشده و نشانگرهای پلتفرم را رد می‌کند.
2. SPA را با Vite می‌سازد.
3. bundle خروجی را برای نشانگرهای Grok/App Builder و script/style خارجی بررسی می‌کند.
4. بسته `dist-cpanel/` را می‌سازد و وجود فایل‌های ضروری و نبود config خصوصی واقعی را بررسی می‌کند.

ساختار بسته:
- `dist-cpanel/public/`: HTML، JS/CSS، assets، `.htaccess` و PHP API
- `dist-cpanel/private/`: bootstrap PHP، تمام routeهای API، helperهای پیامک، نمونه config و deny rule؛ بیرون Document Root
- `dist-cpanel/database/`: schema و migrationهای MySQL

## نتیجه CI تاریخی — مربوط به commitهای قبلی، نه HEAD فعلی

اجرای کامل [GitHub Actions run 44280981233](https://github.com/jalilsh7/3Food-pos/actions/runs/44280981233) موفق شد:
- PHP syntax checks
- ایجاد schema تازه MySQL و بررسی ساختار
- تست یکپارچگی PHP API
- TypeScript، تست‌های واحد و lint
- build مستقل cPanel و ممیزی source/output
- Playwright smoke روی بسته نهایی، با سرور PHP و MySQL تستی
- بارگذاری artifact بسته cPanel

در smoke test مرورگر، صفحه با HTTP 200 بارگذاری شد. تایپ ۴۶ نویسه در فرم ورود در هر دو viewport دسکتاپ و موبایل آزمایش شد؛ زمان ثبت‌شده برای نام کاربری ۴۲ms و رمز عبور ۳۲ms بود. فرم submit نشد و هیچ credential واقعی استفاده نشد.

Artifact:
- نام: `3food-pos-cpanel`
- حجم: 255,262 بایت
- نگهداری تا: 2026-12-02
- دانلود از بخش Artifacts در اجرای GitHub Actions بالا

## موارد خارج از CI

این موارد هنوز باید روی staging واقعی cPanel/LiteSpeed بررسی شوند:
- Apache/LiteSpeed rewrite و مسیرهای واقعی Document Root
- PHP 8.2 و PDO MySQL روی همان هاست مقصد
- setup مدیر اولیه، ورود/خروج و کنترل نقش‌ها
- ثبت سفارش هم‌زمان، موجودی و همگام‌سازی چند دستگاه
- backup/restore و پیامک با credential واقعی و opt-in

موفقیت CI و artifact به معنی استقرار یا تأیید production نیست. هیچ فایل زنده cPanel یا دیتابیس production در این پاک‌سازی تغییر نکرده است.


## وضعیت فعلی شاخه فعال — 2026-11-23

- اسکریپت `scripts/package-cpanel.mjs` بازبینی شد و نقص مهم بسته‌بندی اصلاح شد: فایل `private/api-bootstrap.php` و کل پوشه `private/routes/` اکنون در خروجی cPanel کپی می‌شوند و تک‌تک routeهای موردنیاز در فهرست فایل‌های اجباری بسته قرار دارند. helperهای پیامک و نمونه config نیز بسته‌بندی می‌شوند.
- بررسی ایستای مسیرهای `require_once` در API نشان داد تمام فایل‌های خصوصی موردنیاز dispatcher در فهرست بسته‌بندی قرار گرفته‌اند.
- طبق دستور مالک پروژه، روی HEAD فعلی هیچ build، تست، lint یا typecheck اجرا نشده است. CI تاریخی بالا فقط سابقه commitهای قبلی است و نباید به‌عنوان تأیید HEAD فعلی تلقی شود.
- فایل‌های فونت IRANYekanWeb FarsiNum (شش وزن WOFF) در Git شاخه موجود نیستند و بسته فعلی آن‌ها را عمداً جایگزین نمی‌کند؛ در آپدیت هاست باید از نسخه موجود `public/fonts/` حفظ و منتقل شوند. فایل `iranyekanwebmediumfanum.woff` قبلاً روی هاست با خطای بارگذاری گزارش شده بود و باید در مرحله پذیرش واقعی جداگانه بررسی شود.
- ZIP نهایی جدید هنوز تولید نشده است؛ ZIP اصلی `3food-pos-php-migration(1).zip` دست‌نخورده می‌ماند.
