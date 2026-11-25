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
