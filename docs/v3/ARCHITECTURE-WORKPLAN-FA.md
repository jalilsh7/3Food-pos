# برنامه اجرایی اصلاح معماری سراسری V3

## اصل اجرا
کار گروهی و دسته‌ای؛ تغییرات معماری و انتقال کد در دسته‌های مرتبط. تست/بیلد جامع در پایان پروژه، مگر نیاز فوری به بررسی خاص برای جلوگیری از خطر یا ابهام. تست‌های حذف‌شده/تعویق‌افتاده در backlog ثبت می‌شوند.

## دسته‌های اجرایی

- [x] دسته ۰: بررسی وضعیت شاخه و ثبت استاندارد معماری و نقشه ماژول‌ها.
- [x] دسته ۱ (پایه): قرارداد خطا و logging مشترک در frontend، بدون وابستگی ماژول‌های تجاری.
- [x] دسته ۲-الف: API client correlation context و logging؛ PHP echo header.
- [x] دسته ۲-ب: استخراج اولیه transport/session/contracts به adapters مستقل (client به helperهای پایه متصل شد؛ استخراج resource services بعداً).
- [ ] دسته ۳: استخراج سفارش، فروش و کاتالوگ از featureهای یکپارچه (قرارداد مرزی و ترتیب refactor مستند شد؛ refactor اجرایی هنوز باقی است).
- [ ] دسته ۴: موجودی، رسپی/بهای تمام‌شده، تامین‌کنندگان و هزینه‌ها (مرزبندی و قواعد posting مستند شد؛ refactor اجرایی باقی است).
- [ ] دسته ۵: مشتریان، وفاداری، کمپین‌ها و پیام‌رسانی (مرزبندی مستند؛ refactor اجرایی باقی است).
- [ ] دسته ۶: تنظیمات، کاربران، نقش‌ها، مجوزها و گزارش‌ها (مرزبندی مستند؛ refactor اجرایی باقی است).
- [ ] دسته ۷: PHP API domain boundaries و repository/use-case تفکیک (قرارداد لایه‌ها مستند؛ refactor اجرایی باقی است).
- [ ] دسته ۸: migration ownership، نسخه‌بندی schema، قابلیت‌های تجاری و audit (policy مستند؛ refactor اجرایی باقی است).
- [ ] دسته ۹: فروشگاه آنلاین و integrationها (WooCommerce و adapterهای دیگر) — سند مرزبندی ایجاد شد؛ پیاده‌سازی Backend و اتصال واقعی storefront هنوز باقی است.
- [ ] دسته ۱۰: licensing، entitlements، central-admin و update-management — سند مرزبندی ایجاد شد؛ سرویس اجرایی، پنل مرکزی و updater هنوز باقی است.
- [ ] دسته ۱۱: کاهش coupling، حذف adapterهای موقت، مستندات/نقشه نهایی.
- [ ] دسته نهایی: اجرای تست‌ها، build، تست migration/upgrade، نصب و rollback.

## وضعیت پایه
شاخه توسعه: `feature/3food-pos-next-release-v2`. معماری موجود هنوز ترکیبی از `src/features/pos`، `src/lib/pos` و ماژول pilot پیامک است. مهاجرت به‌صورت incremental خواهد بود و از شکستن APIهای فعلی جلوگیری می‌شود. دسته ۱ قرارداد پایه logger/error، دسته ۲-الف correlation ID frontend/PHP و دسته ۲-ب استخراج اولیه transport/session/contracts ثبت و پیاده‌سازی شد؛ build/test اجرا نشده.

## پیشرفت آخرین دسته
- API client همچنان façade سازگار باقی مانده و از transport policy، correlation helper، و CSRF session adapter جدید استفاده می‌کند.
- query string از actionهای diagnostics حذف می‌شود.
- قرارداد envelope/request و سیاست transport جدا شده‌اند؛ استخراج resource-level serviceها و PHP domain separation هنوز انجام نشده است.

## پیشرفت دسته اخیر — مرزبندی فروش/سفارش/کاتالوگ\n- سند `v3/docs/MODULE_BOUNDARIES_SALES_ORDERS_CATALOG.md` ایجاد شد و قواعد dependency، مسئولیت لایه‌ها، scope، snapshot قیمت و مسیر refactor تدریجی را تعریف می‌کند.\n- هنوز به معنی تغییر اجرایی کامل در service/controller/repositoryهای این ماژول‌ها نیست؛ مرحله بعد انتقال incremental با حفظ API است.\n\n## پیشرفت دسته ۴ — inventory/recipes/costing\n- سند `v3/docs/MODULE_BOUNDARIES_INVENTORY_RECIPES_COSTING.md` ایجاد شد: posting و reversal، idempotency، scope، نسخه رسپی، تامین‌کننده و تفکیک هزینه‌ها.\n- refactor اجرایی serviceها و workflowها هنوز انجام نشده و به‌صورت incremental در ادامه دنبال می‌شود.\n\n## پیشرفت دسته‌های ۵ و ۶ — قراردادها\n- `v3/docs/MODULE_BOUNDARIES_CUSTOMERS_LOYALTY_MESSAGING.md`: CRM، consent، loyalty ledger، campaign preview/dispatch، provider adapter و privacy.\n- `v3/docs/MODULE_BOUNDARIES_CONFIGURATION_ACCESS_REPORTING.md`: configuration، identity/access، authorization، audit، reporting و finance/cash boundaries.\n- این موارد هنوز refactor اجرایی کامل محسوب نمی‌شوند.\n\n## پیشرفت دسته‌های ۷ و ۸ — قرارداد Backend و DB\n- `v3/docs/PHP_DOMAIN_BOUNDARIES.md`: مرزبندی HTTP، application، domain، infrastructure، composition و قواعد scope/transaction/error.\n- `v3/docs/MIGRATION_ENTITLEMENTS_AUDIT_POLICY.md`: policy نسخه‌بندی migrations، entitlements و audit.\n- هنوز refactor اجرایی کامل یا اعتبارسنجی migration runner/schema انجام نشده است.\n\n## فهرست تست نهایی (تعویق)
- TypeScript/typecheck، lint و build کامل frontend.
- تست مستقل و قراردادی ماژول‌ها و dependency-cycle audit.
- PHP lint و API integration tests.
- DB migration fresh-install، upgrade path و rollback.
- احراز هویت، RBAC، tenant/business isolation و audit.
- فروش و سفارش end-to-end، تغییر وضعیت، موجودی، رسپی، گزارش، SMS.
- online storefront، integrationها، licensing/plan/activation.
- بسته‌بندی cPanel و سناریوی استقرار/backup/restore.


## پیشرفت دسته‌های ۹ و ۱۰ — قرارداد فروشگاه، یکپارچگی و لایسنس
- `v3/docs/MODULE_BOUNDARIES_STOREFRONT_INTEGRATIONS.md` ثبت شد. وضعیت واقعی Storefront نیز صریح شد: صفحه فعلی صرفاً پیش‌نمایش با داده ثابت و سبد محلی است و ثبت سفارش/پرداخت/موجودی به Backend متصل نیست.
- `v3/docs/MODULE_BOUNDARIES_LICENSING_UPDATES.md` ثبت شد. تصمیم محصول درباره لایسنس دائمی + یک سال به‌روزرسانی، آفلاین قابل تنظیم و نصب مستقل در قرارداد فنی منعکس شد.
- بررسی tree فعلی نشان داد Backend V3 هنوز controller/service مستقل برای storefront integration، license، central admin یا update management ندارد. بنابراین دسته‌های ۹ و ۱۰ از نظر مستندات مرزبندی انجام شده‌اند، اما از نظر کدنویسی اجرایی باز هستند.


## تحلیل تکمیلی Guest Checkout
- سند `v3/docs/PUBLIC_STOREFRONT_GUEST_ORDER_DESIGN.md` اضافه شد.
- مانع اجرایی مشخص شد: `OrderService::create`، idempotency و audit به actor داخلی وابسته‌اند؛ `BusinessScope` نیز از session/branch داخلی می‌آید. وجود channel با مقدار `storefront` به معنی guest checkout نیست.
- تصمیم ایمنی: ساخت کاربر جعلی، حذف middleware یا پذیرش business_id از کلاینت ممنوع است.
- گام اجرایی بعدی: refactor سازگار actor/idempotency/audit و resolver هویت storefront؛ پس از آن استخراج use case مشترک ثبت سفارش و افزودن مسیر عمومی.

## تثبیت استاندارد نهایی معماری — 2026-11-25
- سند مرجع v3/docs/ARCHITECTURE_CONFORMANCE_STANDARD.md ایجاد شد و شش قانون کاربر را به معیارهای پذیرش اجرایی تبدیل کرد.
- سند شامل ساختار مرجع Feature-Based، جداسازی لایه‌ها، قراردادهای ورودی/خروجی، قواعد dependency، event boundary، logging/correlation، مالکیت و ترتیب migration، مستندات و تست مستقل، feature entitlement، امنیت چندمشتری و معیار پایان تطبیق است.
- این commit فقط استاندارد معماری را تثبیت می‌کند؛ به معنی تطبیق کد موجود نیست.
- مرحله تطبیق هنوز باز است: inventory واقعی همه ماژول‌ها و importها، dependency graph/cycle audit، اتصال logger به تمام مرزها، ثبت مالکیت migrationها و الگوی مستقل docs/tests باید تکمیل شود.
- طبق دستور کاربر، تست جامع و build فقط پس از اتمام تطبیق کلی معماری اجرا می‌شود. تا آن زمان توسعه feature جدید شروع نمی‌شود؛ فقط کارهای inventory و اصلاح معماری مجاز است.

## موجودی واقعی ساختار و مغایرت‌ها — 2026-11-25
- گزارش v3/docs/ARCHITECTURE_CONFORMANCE_INVENTORY.md ایجاد شد.
- Frontend دارای features جدا برای auth/catalog/customers/finance/inventory/kitchen/orders/pos/settings/storefront و shared/api و shared/ui است؛ این پوشه‌بندی اولیه است و به‌تنهایی اثبات استقلال ماژول‌ها نیست.
- Backend دارای دامنه‌های Auth/Catalog/Dining/Finance/Http/Infrastructure/Inventory/Media/Orders/Security است.
- مغایرت اجرایی مشخص: OrderService و IdempotencyService وابستگی‌های PDO/Repository/Transaction را درون خود می‌سازند؛ composition باید به Composition Root منتقل و قراردادهای application از infrastructure جدا شوند.
- database/v3/migrations دارای فایل‌های SQL ترتیبی مرکزی است؛ مالکیت migration به تفکیک ماژول و metadata هنوز نیازمند inventory و تثبیت است.
- تست مستقل همه ماژول‌ها و اتصال logger به تمام مرزها هنوز تأیید نشده است.
- گام بعدی: استخراج dependency graph و public entrypointها، سپس اصلاح composition/DI و قراردادهای اجرایی؛ تست جامع همچنان فقط پس از اتمام تطبیق کلی.


## اصلاح اجرایی Composition و Idempotency — 2026-11-25
- در `v3/backend/src/Orders/OrderService.php` وابستگی‌های OrderRepository، IdempotencyService و AuditLogService به constructor تزریق شدند؛ ساخت آن‌ها از داخل سرویس حذف شد.
- در `v3/backend/src/Security/IdempotencyService.php`، IdempotencyRepository و TransactionManager به constructor تزریق شدند؛ ساخت concrete dependencyها از داخل سرویس حذف شد.
- در `v3/backend/public/index.php`، Composition Root مسئول ساخت و اتصال این وابستگی‌ها شد.
- هر سه فایل پس از commit دوباره از شاخه خوانده شدند و محتوای DI تأیید شد؛ تست یا Build اجرا نشده است.
- مورد باز: PDO هنوز در callback تراکنش به Application نشت می‌کند و OrderService به concrete OrderRepository وابسته است. مرحله بعد طراحی transaction/persistence port با حفظ یکپارچگی تراکنش سفارش و idempotency است.
- logger frontend در `src/core/observability/logger.ts` است و console-backed می‌باشد؛ در مسیر Backend logger مرکزی مستقل در tree مشاهده نشد. اتصال logger ساخت‌یافته مشترک Backend و فیلتر module هنوز باز است.
- tree شاخه 319 فایل داشت. در `database/v3/migrations`، migrationهای 001 تا 012 مشاهده شدند؛ مالکیت دامنه‌ای و metadata هر migration هنوز باید از محتوای SQL استخراج شود.
- تست جامع و Build طبق دستور کاربر همچنان معوق تا پایان تطبیق کلی هستند.


## اصلاح اجرایی مرزهای Orders و Security — 2026-11-25
- `OrderService` دیگر PDO را import یا در callback تراکنش دریافت نمی‌کند.
- `IdempotencyService` نیز callback بدون PDO دارد و به interfaceهای `IdempotencyStore` و `TransactionBoundary` وابسته است.
- `TransactionManager` همچنان PDO را فقط در Infrastructure نگه می‌دارد و callback بدون آرگومان اجرا می‌کند.
- `OrderStore` و `AuditLogWriter` به‌عنوان persistence port ایجاد شدند؛ implementationهای PDO در Infrastructure آن‌ها را پیاده‌سازی می‌کنند.
- فایل‌های تازه با autoloader مبتنی بر namespace/path موجود سازگارند؛ bootstrap مسیر namespace را به فایل PHP نگاشت می‌کند.
- Composition Root فعلی از یک PDO singleton برای OrderRepository، IdempotencyRepository، AuditLogRepository و TransactionManager استفاده می‌کند؛ این موضوع برای حفظ transaction atomicity حیاتی است.
- هیچ build، lint یا تستی اجرا نشده؛ طبق دستور کاربر بررسی نهایی پس از تکمیل تطبیق کلی انجام می‌شود.

## Migration inventory — استخراج اولیه 2026-11-25
- در `database/v3/migrations` فایل‌های شماره‌دار 001 تا 012 شناسایی شدند.
- جداول و دامنه‌های اولیه از SQL استخراج شده‌اند؛ سند مالکیت migration به‌صورت مستقل ثبت می‌شود.
- migrationهای قبلی دست‌نخورده باقی مانده‌اند؛ تغییرات ساختاری جدید باید با migration افزایشی جدید انجام شوند.


## Logging ساخت‌یافته Backend — 2026-11-25
- قرارداد `Support/Logger` و implementation زیرساختی `Infrastructure/Logging/ErrorLogLogger` ایجاد شد.
- خروجی log به‌صورت JSON ساخت‌یافته با timestamp UTC، level، event، module، request_id و context ثبت می‌شود.
- فیلتر ماژول با متغیر محیطی `POS_V3_LOG_MODULES` (فهرست comma-separated) قابل تنظیم است؛ خالی بودن آن همه ماژول‌ها را مجاز می‌کند.
- کلیدهای حساس مانند password/token/secret/authorization/cookie/apiKey/credential در context بازگشتی redact می‌شوند.
- `Http/Kernel` برای exceptionهای کنترل‌نشده از logger مرکزی استفاده می‌کند و module را از مسیر API تشخیص می‌دهد.
- Composition Root، logger را به Kernel تزریق می‌کند. اتصال به use-caseها، provider adapters و عملیات دیتابیس در مراحل بعدی انجام می‌شود؛ این دسته هنوز کامل نیست.


## استخراج Persistence Port برای ماژول‌های Backend — 2026-11-25
- قراردادهای `CatalogStore`, `InventoryStore`, `InventoryDocumentStore`, `InventoryPostingStore`, `SupplierStore`, `DiningStore`, `CashStore`, `RecipeStore` و `MediaStore` ایجاد شدند.
- Repositoryهای متناظر در `Infrastructure/Database` این قراردادها را پیاده‌سازی می‌کنند.
- سرویس‌های Catalog، Inventory، InventoryDocument، InventoryPosting، Supplier، Dining، CashRegister، Recipe و Media از PDO و ساخت Repository درون constructor خارج شدند؛ اکنون port و سرویس‌های مشترک idempotency/audit را دریافت می‌کنند.
- Composition Root مسئول ساخت adapterهای PDO و تزریق آن‌هاست؛ همه adapterهای تراکنشی از همان PDO singleton استفاده می‌کنند تا atomicity حفظ شود.
- commit این دسته روی شاخه توسعه V3 ثبت شد: `0377ac1a67b3cd9b7123a76c1a1d996e449fa8c8`.
- تست/Build اجرا نشده و تا پایان تطبیق کلی معوق است.


## Auth/Access Persistence و تراکنش بدون PDO — 2026-11-25
- Store ports برای Business، User، Role، Session و Permission تعریف و توسط repositoryهای زیرساختی پیاده‌سازی شدند.
- BranchManagementService، RoleManagementService، UserManagementService، PermissionService، BusinessScopeResolver، BusinessContextController، SessionAuthenticator و InstallationOwnerMiddleware به interfaceهای Auth وابسته شدند.
- AuthenticationService و BusinessSetupService اکنون Storeها، TransactionBoundary و AuditLogService را تزریق می‌گیرند.
- AuthController نیز SessionStore، TransactionBoundary و AuditLogService را از Composition Root دریافت می‌کند.
- LoginAttemptLimiter از PDO جدا شد؛ LoginAttemptStore و LoginAttemptRepository مسئول state و SQL محدودیت ورود هستند.
- callbackهای قبلی که PDO دریافت می‌کردند در سرویس‌های تغییرکرده به callback بدون آرگومان تبدیل شدند؛ transaction manager اتصال را در Infrastructure نگه می‌دارد.
- commit دسته جاری: `7290a90f0fa2640d6bc06b56a4faf3b3332a0092`.
- هیچ تست یا build اجرا نشده است؛ این کار طبق دستور کاربر به پایان تطبیق معماری موکول است.


## Dependency Audit و مستندات مستقل — 2026-11-25
- import audit فرانت‌اند انجام شد: featureها در فایل‌های بررسی‌شده فقط shared/api، shared/ui و CSS محلی را مصرف می‌کنند؛ App.tsx composition root است.
- README مستقل برای 12 ماژول/لایه Backend و 12 feature/app/shared بخش Frontend ثبت شد.
- سند `v3/docs/ARCHITECTURE_DEPENDENCY_AUDIT.md` مرزهای فعلی و مغایرت‌های باقی‌مانده را ثبت می‌کند.
- migration manifest ماشینی برای owner/dependencies/risk/tables به runner متصل شد.
- هنوز تست suite مستقل V3 وجود ندارد و هیچ build/test اجرا نشده است.
- موارد باز اصلی: application error contract، shared actor/business context، Orders authorization port، controller query ports، logger application events، تست‌های مستقل و در پایان build/CI.


## Shared Application Contracts و کاهش coupling — 2026-11-25
- ApplicationException از HttpException جدا شد؛ Kernel خطای application را به HTTP response map می‌کند.
- PermissionChecker به‌عنوان port مجوز ایجاد شد؛ OrderService فقط interface را می‌شناسد.
- ActorContext و BusinessContext در Security اضافه شدند؛ Orders، Catalog، Inventory، Dining، Finance، Recipes و Media دیگر AuthenticatedPrincipal/BusinessScope را مستقیماً در service API مصرف نمی‌کنند.
- Controllerهای متناظر context را از request attributes معتبر می‌سازند.
- ماتریس شش قانون و معیار پایان در `v3/docs/ARCHITECTURE_CONFORMANCE_MATRIX.md` ثبت شد.
- تست/build اجرا نشده؛ وضعیت تطبیق همچنان ناقص است.


## Test suites مستقل ایجاد شد — 2026-11-25
- Backend: runner مستقل `v3/backend/tests/run.php` و 12 suite ماژولی برای Auth، Catalog، Orders، Dining، Finance، Inventory، Recipes، Media، Security، Http، Support و Infrastructure ثبت شد.
- Frontend: script `npm test` با Node built-in test runner و تست مستقل هر feature برای جلوگیری از cross-feature imports، استقلال Shared و composition App ثبت شد.
- این تست‌ها هنوز اجرا نشده‌اند؛ طبق دستور کاربر، اجرای تست و build تا پایان تطبیق معماری معوق است.
- AuditLogService اکنون رویداد audit را از طریق Logger مرکزی با module و request_id ثبت می‌کند.
- BusinessScopeContext مشترک، IdempotencyService را از Auth جدا کرد؛ ActorContext/BusinessContext و PermissionChecker نیز coupling سرویس‌های ماژولی را کاهش دادند.


## Application Service Contracts — 2026-11-25
- Application interfaces برای پنج سرویس Auth، سرویس Catalog، Order، Dining، CashRegister، چهار سرویس Inventory، Recipe و Media اضافه شد.
- Controllerهای متناظر از interface استفاده می‌کنند و Composition Root concrete service را inject می‌کند.
- Shared contexts، PermissionChecker و ApplicationException نیز در مرزهای application استفاده می‌شوند.
- Typed DTOهای اختصاصی برای همه payload/resultها هنوز باقی است.
- تست‌های معماری مستقل backend/frontend ایجاد شده‌اند ولی تا پایان تطبیق اجرا نمی‌شوند.


## ثبت مرز ماژول‌های تجاری آتی — 2026-11-25
- README مستقل و test spec برای Customers، Loyalty، Messaging، Reporting، Storefront، Integrations، Licensing، CentralAdmin، Updates و POS آماده شد.
- این 10 ماژول فعلاً boundary/scaffold هستند و application implementation ندارند؛ هیچ feature جدیدی در این دسته پیاده‌سازی نشده است.
- تست runner با suiteهای این ماژول‌ها نیز وجود مستندات را بررسی می‌کند؛ تست‌های رفتاری آن‌ها بعد از پیاده‌سازی و در مرحله نهایی اضافه می‌شوند.
