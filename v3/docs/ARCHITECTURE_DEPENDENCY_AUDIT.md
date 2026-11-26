# گزارش Dependency Audit معماری V3

تاریخ: 2026-11-25  
شاخه: `feature/3food-pos-next-release-v2`

## محدوده بررسی

- Frontend feature entrypoints و importهای مستقیم 19 فایل TypeScript/TSX.
- Backend service/controller/persistence boundaries در ماژول‌های Auth، Catalog، Orders، Dining، Inventory، Recipes، Finance، Media و Security.
- Composition Root، logger و migration runner/manifest.
- بررسی ساختاری و خواندن کد انجام شده است؛ هیچ test/build/lint اجرا نشده است.

## یافته‌های Frontend

- `app/App.tsx` نقش Composition Root را دارد و feature entrypointها را کنار هم قرار می‌دهد.
- featureهای `auth`, `catalog`, `customers`, `finance`, `inventory`, `kitchen`, `orders`, `pos`, `settings`, `storefront` در فایل‌های بررسی‌شده فقط `shared/api`, `shared/ui` و CSS محلی را import می‌کنند.
- import مستقیم feature به feature در فایل‌های بررسی‌شده مشاهده نشد.
- shared به featureها وابسته نیست.
- این نتیجه به فایل‌های فعلی بررسی‌شده محدود است؛ باید در CI با dependency rule خودکار شود.

## یافته‌های Backend

### Composition Root و Persistence
- `v3/backend/public/index.php` مسئول ساخت adapterهای PDO و تزریق به سرویس‌هاست.
- سرویس‌های Catalog، Inventory، InventoryDocument، InventoryPosting، Supplier، Dining، CashRegister، Recipe و Media از PDO و Repository concrete جدا شده‌اند و portهای ماژولی دریافت می‌کنند.
- OrderService به `OrderStore` وابسته است.
- Auth/Access از `BusinessStore`, `UserStore`, `RoleStore`, `SessionStore`, `PermissionStore` استفاده می‌کند.
- Audit دارای portهای جداگانه `AuditLogWriter` و `AuditLogReader` است.
- Media دارای `MediaStorage` port است.
- Login throttling از `LoginAttemptStore` استفاده می‌کند.
- Idempotency و transaction از `IdempotencyStore` و `TransactionBoundary` استفاده می‌کنند.
- Repositoryها در `Infrastructure/Database` و adapter ذخیره‌سازی فایل در `Infrastructure/Storage` باقی می‌مانند.

### وابستگی‌های باقی‌مانده
- سرویس‌های کاربردی هنوز از `HttpException` استفاده می‌کنند؛ قرارداد خطای application مستقل از HTTP باید استخراج و در Kernel map شود.
- چند سرویس Orders/Catalog/Inventory و سایر حوزه‌ها از `AuthenticatedPrincipal` و `BusinessScope` در namespace Auth استفاده می‌کنند؛ این دو باید به shared application context منتقل شوند.
- `OrderService` هنوز `PermissionService` را مستقیم مصرف می‌کند؛ در گام بعدی به authorization port متعلق به Orders تبدیل شود.
- بعضی controllerها/adapterها هنوز به repository concrete وابستگی دارند؛ هر مورد باید یا به query port منتقل شود یا به‌عنوان Composition Root/Infrastructure boundary مستند شود.
- logger ساخت‌یافته در Kernel برای exceptionهای کنترل‌نشده فعال است، اما log eventهای use-caseها و provider adapterها هنوز پوشش کامل ندارند.

## Migration

- runner فعلی baseline checksum، migration checksum، sequence یکتا و advisory lock را کنترل می‌کند.
- `database/v3/migrations/manifest.php` مالکیت، ریسک، جدول‌ها و dependencyهای هر migration را ثبت می‌کند.
- `migrate.php` وجود metadata، ورودی اضافی، owner/risk/tableهای نامعتبر و ترتیب/اعمال‌شدن dependencyها را پیش از اجرای SQL کنترل می‌کند.
- migrationهای SQL 001 تا 012 immutable باقی مانده‌اند.

## مستندات و تست

- برای 12 ماژول/لایه Backend README مستقل ثبت شد.
- برای 10 feature فرانت‌اند، App و Shared README مستقل ثبت شد.
- در tree فعلی V3 هیچ مسیر تست مستقل backend/frontend پیدا نشد. مسیرهای هدف در READMEهای هر ماژول تعریف شده‌اند.
- تست جامع و build طبق دستور کاربر به پایان تطبیق معماری موکول شده‌اند.

## نتیجه این audit

مرزهای Persistence و Composition برای بخش عمده ماژول‌های اصلی اصلاح شده‌اند و frontend feature importها در فایل‌های بررسی‌شده سالم به نظر می‌رسند. با این حال به دلیل خطاهای HTTP/auth context، چند dependency مستقیم، نبود test suites مستقل و اجرا نشدن تست/Build، معماری هنوز منطبق کامل اعلام نمی‌شود.


## تکمیل Shared Context و Error Contracts
- `BusinessScopeContext` به‌عنوان contract مشترک ایجاد شد و هر دو `Auth/BusinessScope` و `Security/BusinessContext` آن را پیاده‌سازی می‌کنند؛ IdempotencyService دیگر به Auth وابسته نیست.
- سرویس‌های Catalog، Orders، Inventory، Dining، Finance، Recipes و Media اکنون ActorContext/BusinessContext می‌گیرند؛ Controllerها از session principal و resolved business scope این contextها را می‌سازند.
- `PermissionChecker` جای وابستگی مستقیم OrderService به PermissionService را گرفته است.
- `ApplicationException` خطای application است؛ Kernel آن را به HTTP response تبدیل می‌کند و HttpException فقط subclass سازگار با controllerهاست.
- `AuditLogService` از Logger مرکزی استفاده می‌کند و action، module، request_id و شناسه‌های entity/scope را بدون snapshot یا secret log می‌کند.

## Test Suite Scaffolding
- برای 12 ماژول Backend تست‌های مستقل معماری در `v3/backend/tests/Modules/<Module>/ArchitectureTest.php` اضافه شد.
- runner بدون وابستگی خارجی در `v3/backend/tests/run.php` قرار گرفت؛ اجرا: `php tests/run.php` از پوشه backend.
- برای Frontend، Node built-in test runner با script `npm test` اضافه شد؛ تست‌ها عدم import مستقیم feature به feature، استقلال shared و composition در App را بررسی می‌کنند.
- تست‌ها ایجاد شده‌اند اما هنوز اجرا نشده‌اند؛ این مطابق دستور تست نهایی در پایان تطبیق است.


## Application API contracts — 2026-11-25
- Interfaceهای Application برای Auth (پنج سرویس)، Catalog، Orders، Dining، Finance، Inventory (چهار سرویس)، Recipes و Media ایجاد شدند.
- Controllerهای این ماژول‌ها به interface وابسته‌اند؛ Composition Root implementationهای concrete را تزریق می‌کند.
- قراردادهای عمومی method signatures را تثبیت می‌کنند؛ typed DTOهای اختصاصی برای همه payloadها و Resultها هنوز کامل نیستند.
- تست‌های معماری backend برای هر ماژول ایجاد و frontend test script اضافه شده؛ اجرا نشده‌اند.

## Migration ownership parity guard — 2026-11-26
- اختلاف واقعی migration 011 شناسایی شد: SQL علاوه بر جدول‌های ثبت‌شده در manifest، سه جدول موجود pos_product_variants، pos_order_items و pos_order_item_recipe_lines را نیز تغییر می‌داد.
- هر سه جدول به فهرست مالکیت migration 011 اضافه شدند؛ فایل SQL دست‌نخورده و immutable باقی ماند.
- database/v3/bin/migrate.php اکنون پیش از اجرای migration، target tableهای استخراج‌شده از CREATE/ALTER/DROP TABLE را با manifest مقایسه می‌کند و در صورت اختلاف متوقف می‌شود.
- v3/backend/tests/run.php همین برابری را به‌صورت static architecture check پوشش می‌دهد تا خطا بدون اتصال دیتابیس نیز قابل شناسایی باشد.
- این تغییر فقط کنترل metadata است؛ هیچ migration روی دیتابیس اجرا نشده و هیچ داده‌ای تغییر نکرده است.


## Planned commercial modules — 2026-11-25
Customers، Loyalty، Messaging، Reporting، Storefront، Integrations، Licensing، CentralAdmin، Updates و POS دارای README مستقل و suite مستقل بررسی وجود مستندات شدند. این‌ها boundary/scaffold هستند؛ implementation و application contracts آن‌ها هنوز ساخته نشده است.


## Dependency Graph Guard — 2026-11-25
- `v3/backend/tests/Architecture/DependencyGraphTest.php` به runner متصل شد.
- این guard تمام PHP sourceهای Backend را اسکن می‌کند؛ Application Service/Contractها نباید PDO، HTTP، Infrastructure یا ماژول دامنه دیگر را import کنند و Controllerها نباید PDO/Infrastructure را مستقیم مصرف کنند.
- تست‌های ماژولی اکنون وجود interface، پیاده‌سازی interface توسط Service و نبود body در Application interface را نیز کنترل می‌کنند.
- guard و suiteها ایجاد شده‌اند اما هنوز اجرا نشده‌اند.

## Static Boundary Recheck — 2026-11-25

- هر 18 فایل Application Service در Backend بررسی شد؛ هیچ‌کدام PDO، Repository concrete، Infrastructure، HTTP یا Auth را import/instantiate نمی‌کنند. وابستگی‌ها به ماژول خود، Security و Support محدود است.
- هر 15 Controller بررسی شد؛ هیچ‌کدام PDO یا Infrastructure import نمی‌کنند و هیچ Service/Repository concrete داخل Controller ساخته نمی‌شود.
- هر 15 Application interface بررسی شد؛ فایل‌ها فقط signature/docblock دارند و method body ندارند.
- 12 migration SQL از نظر table target با manifest تطبیق دستی داده شدند؛ runner نیز همین تطبیق را به‌صورت خودکار کنترل می‌کند.
- این‌ها static inspection هستند؛ architecture runner، PHP lint، frontend tests و build هنوز اجرا نشده‌اند.
