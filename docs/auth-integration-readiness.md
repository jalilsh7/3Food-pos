# وضعیت آمادگی اتصال احراز هویت PHP به رابط کاربری

تاریخ بررسی: 2026-11-17  
شاخه بررسی‌شده: `migration/php-mysql`

## نتیجه دقیق

باید بین دو موضوع تفاوت گذاشت:

1. **آرشیو محلی مهاجرت:** فایل `3food-pos-php-migration.zip` شامل سورس کامل رابط کاربری و فایل‌های احراز هویت است.
2. **شاخه GitHub:** شاخه `migration/php-mysql` هنوز فقط مستندات و بخشی از فایل‌های مهاجرت را دارد و snapshot کامل برنامه نیست.

بنابراین فایل‌های احراز هویت وجود دارند و بررسی شدند؛ اما هنوز در شاخه GitHub قرار نگرفته‌اند. گزارش قبلی فقط درباره موجودی شاخه GitHub درست بود و نباید به معنی نبود فایل‌ها در آرشیو مهاجرت برداشت شود.

## تطبیق آرشیوها

دو آرشیو `grok-workspace.zip` و `3food-pos-php-migration.zip` استخراج و مقایسه شدند:

- سورس اصلی، پس از کنار گذاشتن پوشه‌های محیطی/خروجی مانند `.grok`، `.vercel` و `.tanstack`: تعداد 107 فایل.
- آرشیو مهاجرت: 115 فایل.
- هر 107 فایل مشترک، از نظر SHA-256 بایت‌به‌بایت یکسان هستند.
- هیچ فایل سورس اصلی در آرشیو مهاجرت حذف یا تغییر نکرده است.
- 8 فایل اضافه‌شده مربوط به مستندات و backend اولیه PHP/MySQL هستند.

این تطبیق، یکپارچگی فایل‌های سورس مشترک را تأیید می‌کند؛ اما به‌تنهایی build یا عملکرد مهاجرت را تأیید نمی‌کند.

## فایل‌های احراز هویت بررسی‌شده

- `src/lib/auth/provider.tsx`
- `src/lib/auth/use-current-user.ts`
- `src/lib/auth/client.ts`
- `src/lib/auth/gates.tsx`
- `src/lib/auth/middleware.ts`
- `src/lib/auth/verify.server.ts`
- `src/routes/__root.tsx`

نکته‌های مهم:
- `AuthProvider` فعلی صرفاً wrapper است و خودش session را مدیریت نمی‌کند.
- `useCurrentUserState` مستقیماً به `authClient.useSession()` و Better Auth متصل است.
- کلاینت فعلی از OAuth providerها، bearer token مخصوص preview و منطق popup/sign-out استفاده می‌کند.
- guardهای UI در `gates.tsx` از همین hook استفاده می‌کنند.
- `middleware.ts` وابسته به `@tanstack/react-start` و `createMiddleware` است؛ بنابراین حذف Better Auth فقط با تعویض یک provider تمام نمی‌شود.
- `__root.tsx`، `AuthProvider` را mount می‌کند.

## دروازه‌های لازم برای ادامه

1. انتقال snapshot کامل آرشیو مهاجرت به شاخه `migration/php-mysql` و حفظ `main`.
2. ادغام امن کلاینت PHP که در GitHub ثبت شده با سورس واقعی.
3. جایگزینی تدریجی session hook و عملیات sign-in/sign-out، بدون باقی‌ماندن مسیر OAuth/Better Auth در build نهایی.
4. حذف یا بازنویسی server functions و middlewareهای TanStack Start که به runtime قبلی متکی‌اند.
5. بررسی صفحه ورود واقعی، routeها و همه عملیات محافظت‌شده.
6. اجرای typecheck، تست‌ها، build استاتیک و سپس تست PHP/MySQL روی staging.

## وضعیت انتشار

هیچ deploy انجام نشده است. تا زمانی که شاخه مهاجرت شامل سورس کامل، build موفق و تست‌های session/CSRF/RBAC و عملیات اصلی POS نباشد، ZIP قابل نصب یا انتشار تولید نشود.
