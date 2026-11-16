# راهنمای تحویل و ادامه توسعه 3Food POS برای هر دستیار هوش مصنوعی

آخرین بازبینی: 2026-11-17  
مخزن: https://github.com/jalilsh7/3Food-pos  
شاخه کاری مهاجرت: `migration/php-mysql`  
شاخه اصلی: `main` (باید دست‌نخورده بماند مگر با اجازه صریح مالک)

> این سند برای انتقال زمینه پروژه به هر دستیار هوش مصنوعی نوشته شده است. ابتدا وضعیت واقعی مخزن را بررسی کنید؛ این راهنما به معنی تکمیل یا استقرار برنامه نیست.

## 1) هدف محصول

ساخت یک سیستم POS مستقل برای 3Food روی `pos.3food.ir` با رابط React و بک‌اند PHP/MySQL؛ قابل استفاده هم‌زمان از چند دستگاه و بدون وابستگی runtime به Vercel، Grok، Nitro، PostgreSQL یا PGlite.

هاست مقصد cPanel با Apache و PHP است. Node.js روی هاست مقصد در دسترس فرض نشود. Node فقط برای build در محیط توسعه یا CI استفاده شود و خروجی React به‌صورت فایل استاتیک deploy شود؛ API با PHP اجرا شود.

## 2) نیازمندی‌های قطعی مالک

- ورود همه کاربران، از جمله مدیر، فقط با username/password واقعی و احراز هویت سمت سرور.
- نقش‌ها: `manager`، `cashier`، `kitchen`.
- مدیریت کاربران و نقش‌ها توسط مدیر.
- فقط مدیر اجازه ویرایش محتوای سفارش را دارد.
- چند دستگاه باید از یک دیتابیس مرکزی MySQL استفاده کنند؛ localStorage منبع حقیقت نباشد.
- پیامک فقط برای مشتری ارسال شود؛ کلیدها فقط سمت سرور باشند. شکست سرویس پیامک نباید ثبت سفارش را متوقف کند.
- ثبت‌نام عمومی ممنوع؛ ایجاد مدیر اولیه فقط با setup token امن و یک‌بارمصرف.
- شماره سفارش اتمیک، تراکنش‌های امن و idempotency برای درخواست‌های تکراری.
- امکانات موردنیاز: سفارش، وضعیت آشپزخانه، انبار، مشتریان/باشگاه مشتریان، تاریخچه امتیاز و تراکنش، گزارش‌ها، backup/restore.
- قبل از انتشار اصلی، staging و تست کامل الزامی است.
- ZIP نهایی فقط پس از تکمیل، build و تست واقعی تحویل شود.

## 3) وضعیت واقعی مخزن در آخرین بررسی

درخت شاخه `migration/php-mysql` در commit `5ac7131769a09508ee1ffa55ea17327b756cda8a` فقط این فایل‌های tracked را نشان می‌داد:
- `README.md`
- `docs/auth-integration-readiness.md`
- `docs/auth-source-analysis.md`
- `docs/phase-2-backlog.md`
- `docs/php-api-client-contract.md`
- `docs/source-audit.md`
- `docs/static-build-readiness.md`
- `src/lib/api/php-client.ts`

بعداً گزارش تست در commit `7a77d921852d72601a98fcad8d4576a8826236f4` به‌روزرسانی شد. **سورس کامل برنامه و پوشه PHP backend هنوز در این شاخه نیستند.** فایل‌های PHP که در آرشیو مهاجرت محلی بررسی شده‌اند در GitHub branch وجود ندارند. انتقال کامل هنوز انجام نشده است.

آرشیو مرجع محلی که مالک باید در دسترس قرار دهد: `grok-workspace.zip` (حدود 1.93 MB). آرشیو مهاجرت محلی: `3food-pos-php-migration.zip` (حدود 717 KB). فایل `3food-pos-php-final-source.zip` با حجم حدود 58 KB ناقص است و نباید مبنا قرار گیرد.

## 4) معماری فعلی و کارهای مهاجرت

سورس اصلی React 19 / TypeScript / Vite / TanStack Start است. پیکربندی فعلی از `tanstackStart()` و Nitro با preset Vercel استفاده می‌کند. مهاجرت باید runtime سرور TanStack/Nitro را از خروجی deploy حذف کند، اما نباید routeها یا قابلیت‌های برنامه بی‌برنامه حذف شوند.

موارد شناخته‌شده:
- `src/lib/pos/store.ts` از Zustand `persist` استفاده می‌کند؛ باید به API PHP متصل شود و localStorage فقط در صورت نیاز برای cache/صف موقت باشد.
- `src/lib/auth/client.ts`، `server.ts`، `middleware.ts` و `use-current-user.ts` به Better Auth / TanStack Start / OAuth و زیرساخت قبلی متکی‌اند؛ باید به session PHP تبدیل شوند.
- `src/routes/__root.tsx` از AuthProvider استفاده می‌کند؛ `src/lib/auth/provider.tsx` فعلاً wrapper خالی است.
- `src/lib/app-data/readiness.ts` و `createServerFn`های مشابه به runtime قبلی وابسته‌اند و باید بازطراحی شوند.
- route مستقل login در بررسی قبلی پیدا نشده، در حالی که gateها مسیر `/login` را انتظار دارند.
- `src/lib/api/php-client.ts` در شاخه هست و پایه ارتباط same-origin با `/api/v1`، session cookie و CSRF را فراهم می‌کند؛ هنوز به auth UI و store وصل نشده است.

## 5) یافته‌های بک‌اند PHP/MySQL محلی

آرشیو مهاجرت محلی شامل API و schema اولیه بوده است. مسیرهای مورد بررسی:
- `/health`
- `/setup/manager`
- `/auth/login`
- `/auth/me`
- `/auth/logout`
- `/auth/change-password`
- `/users`
- `/bootstrap`
- `/records/{resource}`
- `/orders`
- `/orders/{id}/status`

موارد مهمی که باید پیش از production اصلاح/تست شوند:
- endpoint سفارش قبلاً totals ارسالی client را ذخیره می‌کرد؛ فقط subtotal به‌صورت محدود با قیمت محصول/گزینه‌ها مقایسه می‌شد. تمام قیمت‌ها، تخفیف، مالیات، امتیاز و مبلغ نهایی باید از داده معتبر DB سمت سرور محاسبه شوند.
- idempotency برای ثبت سفارش لازم است.
- bootstrap قبلاً به 500 سفارش محدود بود؛ pagination/cursor و فیلترها لازم‌اند.
- endpoint ویرایش محتوای سفارش manager-only در نسخه محلی به‌صورت آزمایشی اضافه شده بود، اما به GitHub منتقل یا با MySQL واقعی تست نشده است.
- تراکنش سفارش، موجودی، مشتری، امتیاز و audit باید اتمیک باشند.
- session invalidation پس از تغییر رمز/نقش و غیرفعال‌سازی کاربر باید تست شود.
- setup token باید یک‌بارمصرف، محدود و پس از نصب غیرقابل استفاده باشد.
- backup/restore امن و آزمون بازیابی لازم است.

## 6) تست‌های انجام‌شده و محدودیت‌ها

گزارش محلی آخرین اجرا:
- 197 تست اسکریپتی Node با بازیابی فایل‌های لازم `.grok/skills/og` و `.grok/app-env.json` (بدون secrets): 197 موفق، 0 ناموفق.
- `php -l php-backend/public/api/index.php`: موفق.
- `php -l php-backend/private/config.example.php`: موفق.
- تست‌های TypeScript در `npm test` به‌علت نصب نبودن وابستگی‌هایی مانند `@tanstack/react-start` و `jose` اجرا نشدند.
- `npm ci --ignore-scripts --no-audit --no-fund` در محیط قبلی timeout شد؛ build و typecheck واقعی انجام نشده‌اند.
- محیط بررسی فاقد `pdo_mysql` بود؛ MySQL واقعی و integration test انجام نشده‌اند.

این نتایج را فقط به‌عنوان تست‌های محلی گزارش کنید؛ آن‌ها اثبات deploy readiness نیستند.

## 7) محیط staging موجود

مالک قبلاً این موارد را در cPanel آماده کرده است:
- دیتابیس staging: `smotckkb_3food_staging`
- DB user: `smotckkb_3food-pos`
- DB host: `localhost`
- پوشه: `public_html/pos-staging`
- Directory Privacy فعال.
- مالک گفته افزونه‌های PDO، PDO_MySQL، cURL، OpenSSL و Mbstring در cPanel فعال‌اند.

رمز دیتابیس قبلاً در مکالمه افشا شده؛ آن را secret افشاشده فرض کنید و به مالک توصیه کنید rotate کند. هرگز رمز را در Git، log، issue، مستندات یا chat تکرار نکنید. تنظیمات واقعی باید خارج از web root و خارج از Git نگهداری شوند. فایل config نمونه فقط placeholder داشته باشد.

هیچ فایل ناقص یا ناتست‌شده‌ای را در staging یا دامنه اصلی deploy نکنید.

## 8) ترتیب کار پیشنهادی برای دستیار بعدی

1. ابتدا کل درخت مخزن و شاخه‌ها را بررسی کنید؛ این سند را به‌عنوان وضعیت زنده فرض نکنید.
2. از مالک بخواهید فایل اصلی `grok-workspace.zip` و آرشیو `3food-pos-php-migration.zip` را در محیط کاری در دسترس قرار دهد، اگر فایل‌ها در workspace موجود نیستند.
3. آرشیوها را استخراج و manifest شامل مسیر، اندازه، SHA-256 تولید کنید. فایل‌های `.env`، credentials، private keys، cache، build output و هرگونه secret را قبل از commit حذف کنید.
4. سورس اصلی را در شاخه `migration/php-mysql` قرار دهید؛ `main` را دست نزنید. فایل‌های مشترک را با hash مقایسه کنید و هیچ نسخه‌ای را کورکورانه overwrite نکنید.
5. بک‌اند PHP و schema را اضافه کنید؛ secrets فقط در config خارج از web root.
6. CI اضافه کنید: npm ci، lint، typecheck، تست‌های unit، build استاتیک و PHP lint. CI نباید خودکار deploy کند.
7. auth React را به PHP session متصل کنید؛ login/logout/me/change-password، CSRF و RBAC را با تست پوشش دهید.
8. Zustand store را به API و MySQL منتقل کنید؛ multi-device، pagination، retry، offline queue و idempotency را طراحی و تست کنید.
9. محاسبات مالی سفارش را کاملاً server-side کنید؛ سفارش، موجودی، امتیاز و audit باید transactional باشند.
10. امکانات مشتری/باشگاه، انبار، آشپزخانه، پیامک مشتری و backup/restore را تکمیل کنید.
11. روی staging واقعی با MySQL تست کنید؛ سپس فقط با تأیید مالک انتشار اصلی انجام شود.
12. در پایان ZIP کامل شامل source، build، schema، install guide و changelog بسازید و با unzip/test/hash آن را verify کنید.

## 9) قواعد همکاری با مالک

- مالک مبتدی است؛ دستورالعمل‌ها باید مرحله‌به‌مرحله، کوتاه و دقیق باشند.
- از مالک نخواهید کارهای تکراری انجام دهد یا هر مرحله را با «مرحله بعدی» تأیید کند.
- فقط وقتی اطلاعات/دسترسی واقعاً مسدودکننده است یک سؤال روشن بپرسید.
- گزارش پیشرفت باید تفکیک کند: انجام‌شده، تست‌شده، منتقل‌شده به GitHub، deployشده. این‌ها یکسان نیستند.
- هیچ‌وقت ادعای اجرای تست، commit، upload یا deploy بدون نتیجه واقعی نکنید.
- هر تغییر را روی شاخه `migration/php-mysql` انجام دهید و commit مشخص ارائه کنید.
- فایل ZIP ناقص قبلی را نسخه نهایی معرفی نکنید.
- پیش از destructive changes، backup و تأیید مالک لازم است.

## 10) منابع داخل مخزن

- `docs/source-audit.md`: یافته‌های سورس اصلی.
- `docs/static-build-readiness.md`: وضعیت آماده‌سازی build استاتیک.
- `docs/auth-source-analysis.md`: وابستگی‌های احراز هویت قبلی.
- `docs/auth-integration-readiness.md`: آمادگی اتصال auth.
- `docs/php-api-client-contract.md`: قرارداد کلاینت API.
- `docs/phase-2-backlog.md`: backlog و نتایج تست‌های ثبت‌شده.
- `src/lib/api/php-client.ts`: کلاینت اولیه PHP API.

## 11) شروع سریع برای هر هوش مصنوعی

پیام پیشنهادی برای شروع کار:

«مخزن خصوصی jalilsh7/3Food-pos را بررسی کن. ابتدا AGENTS.md و AI_HANDOFF_FA.md و تمام docs را بخوان. فقط روی شاخه migration/php-mysql کار کن و main را تغییر نده. وضعیت واقعی فایل‌ها را با GitHub tree بررسی کن؛ هنوز انتقال کامل سورس انجام نشده است. نیازمندی‌های مالک و محدودیت‌های امنیتی را رعایت کن. به‌جای گزارش صرف، کار را در commitهای کوچک و قابل بررسی پیش ببر. هر تست را واقعاً اجرا و نتیجه دقیق را ثبت کن. هرگز secrets را commit نکن یا بدون تست deploy نکن.»
