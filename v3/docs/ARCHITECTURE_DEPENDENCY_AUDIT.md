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
