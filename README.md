# 3Food POS — V2

> **این مخزن در این شاخه فقط پروژه V2 را دنبال می‌کند.** شاخه پاک‌سازی و تجمیع V2: `v2/clean-mainline`. پس از انتقال و تأیید، `main` مرجع ادامه توسعه خواهد بود. V3 خارج از محدوده این README و workflow است.

## معرفی
صندوق فروشگاهی فارسی و RTL برای رستوران و فست‌فود، با رابط React و بک‌اند مستقل PHP/MySQL، قابل استقرار روی cPanel/LiteSpeed.

## معماری
- Frontend: React 19 + TypeScript + Vite + TanStack Router، خروجی SPA استاتیک.
- Backend: PHP API در `php-backend/public/api` با مسیر هم‌مبدأ `/api/v1`.
- Database: MySQL/InnoDB.
- Authentication: نشست PHP، کوکی امن HttpOnly، CSRF و RBAC سمت سرور.
- Roles: `manager`، `cashier`، `kitchen`.
- Hosting: cPanel/LiteSpeed با PHP 8.2 و MySQL؛ Node فقط برای توسعه، build و CI لازم است.
- Build: `npm run build:cpanel`؛ تولید خروجی استاتیک و بسته ZIP. فایل تنظیمات خصوصی واقعی نباید وارد Git یا ZIP عمومی شود.

## قابلیت‌های V2
فروش و سفارش؛ گردش آشپزخانه؛ منو و محصولات؛ مواد اولیه و انبار؛ تأمین‌کننده؛ مشتریان و امتیاز وفاداری؛ کد تخفیف؛ هزینه‌ها و گزارش‌ها؛ تنظیمات فروشگاه؛ قالب‌ها، رویدادها و کمپین پیامکی.

## پیامک
دو مسیر باید مستقل پیاده‌سازی شوند:
1. ارسال عادی از خط اختصاصی/شخصی برای پیام آزاد و کمپین.
2. ارسال خدماتی اشتراکی بر اساس متن الگوی ثبت و تأییدشده و `bodyId`.

جزئیات endpointهای REST و SmartSMS، محدودیت‌ها، کدهای پاسخ و الزامات پنل در [دفترچه یکپارچه V2](docs/v2/V2-PROJECT-HANDBOOK-FA.md) ثبت شده است. اعتبارنامه فقط سمت سرور نگهداری شود؛ خطای پیامک نباید ثبت سفارش را متوقف کند.

## قواعد امنیت و توسعه
- داده عملیاتی در MySQL؛ محاسبات مهم سفارش سمت سرور اعتبارسنجی شوند.
- secrets/session/CSRF/API keys در localStorage یا Zustand persist قرار نگیرند.
- مسیر اجرای cPanel به Grok/App Builder، Better Auth، TanStack Start/Nitro، PostgreSQL/PGLite وابسته نباشد.
- همگام‌سازی فعلی چنددستگاهی polling دوره‌ای است، نه بلادرنگ.
- هیچ استقرار production بدون تأیید مالک، backup و rollback plan انجام نشود.

## وضعیت
هسته PHP/MySQL، نشست و RBAC، endpointهای پایه سفارش و داده و بسته‌بندی cPanel در مستندات پیاده‌سازی‌شده گزارش شده‌اند؛ این گزارش جای تست روی commit جاری را نمی‌گیرد. اولویت جاری: تکمیل تنظیمات پیامک، ارسال عادی و خدماتی، رویدادها، کمپین و گزارش؛ سپس تست و build نهایی در پایان فاز. تست staging و پذیرش واقعی قبل از انتشار لازم است.

## دستورات
```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build:cpanel
```

## مستندات مرجع
- [دفترچه یکپارچه پروژه V2](docs/v2/V2-PROJECT-HANDBOOK-FA.md)
- [راهنمای تحویل به توسعه‌دهنده بعدی](docs/v2/AI_HANDOFF_FA.md)
- [وضعیت پیاده‌سازی](docs/v2/IMPLEMENTATION-STATUS-FA.md)
- [قرارداد PHP API](docs/v2/php-api-client-contract.md)
- [ممیزی تاریخی مهاجرت](docs/v2/SOURCE-AUDIT-PHP-MYSQL-FA.md)

## Workflow
فایل `.github/workflows/v2-quality.yml` بررسی‌های PHP syntax، TypeScript، تست‌ها، lint و بسته‌بندی cPanel را برای تغییرات V2 اجرا می‌کند. CI موفق، جایگزین تست staging یا ارسال زنده SMS نیست.
