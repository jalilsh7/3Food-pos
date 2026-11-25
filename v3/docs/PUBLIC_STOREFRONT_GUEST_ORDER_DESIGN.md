# طراحی فنی هویت سفارش عمومی و مسیر Guest Checkout — V3

## یافته‌های قطعی از کد فعلی
- مسیر `POST /api/v1/orders` فقط با session، permission، CSRF و origin middleware ثبت شده است.
- `OrderController::create` یک `AuthenticatedPrincipal` و `BusinessScope` اجباری استخراج می‌کند.
- `OrderService::create` امضای actor از نوع `AuthenticatedPrincipal` دارد؛ برای کانال POS مجوز `pos.sell` را بررسی می‌کند.
- `IdempotencyService::execute` در فراخوانی سفارش، شناسه عددی actor را دریافت می‌کند.
- `AuditLogService` نیز actor داخلی را برای رخدادهای ثبت سفارش استفاده می‌کند.
- کانال `storefront` در فهرست کانال‌های سفارش وجود دارد، اما این مورد به معنی پشتیبانی از سفارش عمومی نیست.
- `BusinessScope` به business و branch اشاره دارد؛ نگاشت عمومی domain/slug به scope در مسیر عمومی فعلی وجود ندارد.

## نتیجه معماری
Guest checkout نباید با ساختن کاربر داخلی جعلی، دور زدن middleware یا بازاستفاده مستقیم از endpoint مدیریتی پیاده شود. باید دو مفهوم از هم جدا شوند:
1. **Actor (عامل تغییر):** کاربر داخلی احراز هویت‌شده یا هویت سیستمی/مهمان محدودشده با نوع actor مشخص.
2. **Business Scope (محدوده داده):** کسب‌وکار و شعبه‌ای که سفارش برای آن ثبت می‌شود؛ این scope باید از شناسه عمومی storefront معتبر resolve شود، نه از ورودی آزاد کلاینت.

## قرارداد پیشنهادی
- `StorefrontIdentity`: شناسه عمومی/slug یا دامنه متصل به storefront و وضعیت انتشار آن.
- `PublicStorefrontContext`: business، branch، تنظیمات عمومی منتشرشده و سیاست‌های ordering؛ فقط از resolver سمت سرور ساخته شود.
- `OrderActor`: نوع actor، شناسه nullable داخلی، شناسه عمومی درخواست‌کننده در صورت وجود، و context لازم برای audit. هویت مهمان نباید به شناسه کاربر داخلی تبدیل شود.
- `IdempotencyContext`: scope، operation و کلید؛ مالکیت کلید برای مهمان باید به‌صورت امن به storefront و fingerprint درخواست مقید باشد، نه صرفاً IP.
- `AuditActor`: actor type و nullable user id؛ audit باید بتواند رخداد guest/system را بدون FK جعلی ثبت کند.
- `GuestOrderAccess`: توکن تصادفی با entropy کافی، ذخیره hash، انقضا و scope محدود به یک سفارش؛ برای مشاهده وضعیت، نه دسترسی به پنل داخلی.
- `PublicOrderInput`: فقط شناسه محصول/variant/option، تعداد، روش دریافت و اطلاعات ضروری گیرنده. قیمت، تخفیف، مالیات، هزینه ارسال و وضعیت پرداخت از کلاینت معتبر تلقی نشوند.

## ترتیب تغییرات اجرایی
1. بررسی و اصلاح مدل actor در idempotency و audit با حفظ سازگاری actorهای فعلی.
2. افزودن resolver برای storefront عمومی و business/branch scope؛ تا زمان وجود تنظیم انتشار/slug در schema، endpoint عمومی نباید از business_id خام استفاده کند.
3. استخراج متد application-level ثبت سفارش از کنترلر HTTP، به‌گونه‌ای که POS و storefront یک مسیر محاسبه قیمت و snapshot داشته باشند.
4. افزودن سیاست مستقل کانال storefront: نرخ درخواست، محدودیت payload، idempotency، اعتبارسنجی ساعات/روش دریافت و سیاست موجودی.
5. صدور token دسترسی سفارش مهمان و endpoint محدود مشاهده وضعیت.
6. سپس اتصال UI فروشگاه و درگاه پرداخت آنلاین.

## مواردی که نباید انجام شوند
- ساخت user داخلی جعلی برای مهمان.
- پذیرفتن business_id یا branch_id آزاد از مرورگر.
- اعتماد به قیمت یا total محاسبه‌شده در frontend.
- انتشار مستقیم همه خروجی‌های CatalogRepository بدون فیلتر فیلدهای عمومی.
- استفاده از endpointهای داخلی با حذف ساده middleware.
- ثبت اطلاعات حساس گیرنده یا token خام در log.

## معیار پذیرش
- actor مهمان در audit قابل تشخیص است و user_id جعلی ندارد.
- کلید idempotency مهمان بین storefrontهای مختلف قابل استفاده مجدد نیست.
- سفارش مهمان و POS از یک هسته محاسبه قیمت/اقلام استفاده می‌کنند.
- هیچ ورودی کلاینتی قادر به تغییر scope کسب‌وکار نیست.
- token مشاهده سفارش فقط به همان سفارش و تا زمان انقضا دسترسی می‌دهد.
- هیچ داده محرمانه داخلی در پاسخ public منتشر نمی‌شود.

این سند طراحی و تحلیل وابستگی‌هاست؛ تغییرات اجرایی هنوز اعمال نشده‌اند.
