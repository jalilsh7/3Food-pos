# موجودی تطبیق معماری V3 — بررسی ساختار شاخه

شاخه بررسی‌شده: feature/3food-pos-next-release-v2  
تاریخ: 2026-11-25

> این گزارش بر اساس ساختار قابل مشاهده در GitHub و فایل‌های بررسی‌شده تهیه شده است. چون تست/build و تحلیل کامل همه importها اجرا نشده، مواردی که هنوز به‌طور کامل بررسی نشده‌اند صریحاً «نیازمند بررسی» هستند.

## 1) نمای فعلی Frontend

مسیر اصلی: v3/frontend/src

ساختار مشاهده‌شده:
- app/
- features/
- shared/
  - api/
  - ui/
- main.tsx
- styles.css
- tokens.css

Featureهای مشاهده‌شده:
- auth
- catalog
- customers
- finance
- inventory
- kitchen
- orders
- pos
- settings
- storefront

### ارزیابی
- تفکیک featureها از نظر پوشه‌بندی اولیه وجود دارد.
- shared/api و shared/ui نقاط اشتراک اولیه هستند.
- ساختار فعلی هنوز با الگوی کامل مستقل module شامل contracts/application/domain/infrastructure/ui/tests/docs برای همه featureها تطبیق اثبات‌شده ندارد.
- نباید صرف وجود feature folder را معادل ماژول مستقل دانست.
- باید importهای cross-feature، دسترسی مستقیم به API و منطق تجاری داخل UI به‌صورت سراسری inventory شوند.

## 2) نمای فعلی Backend

مسیر اصلی: v3/backend/src

پوشه‌های مشاهده‌شده شامل:
- Auth
- Catalog
- Dining
- Finance
- Http
- Infrastructure
- Inventory
- Media
- Orders
- Security

در Orders حداقل OrderController.php و OrderService.php مشاهده شد.
در Security سرویس‌های AuditLogService.php و IdempotencyService.php و middlewareهای امنیتی مشاهده شدند.
در Infrastructure حداقل Database و Storage وجود دارند.

### اصلاحات اجرایی ثبت‌شده در 2026-11-25

- Composition سفارش در `v3/backend/public/index.php` مسئول ساخت Repositoryها، سرویس‌های امنیتی و TransactionManager است؛ همه آن‌ها از factory اتصال مشترک استفاده می‌کنند.
- قرارداد callback در `OrderService`، `IdempotencyService` و `TransactionManager` دیگر `PDO` را به لایه کاربردی منتقل نمی‌کند؛ تراکنش همچنان در زیرساخت اجرا می‌شود.
- `Orders/OrderStore.php` به‌عنوان persistence port ایجاد شد؛ `Infrastructure/Database/OrderRepository.php` آن را پیاده‌سازی می‌کند و `OrderService` اکنون به interface وابسته است.
- `Security/AuditLogWriter.php` به‌عنوان port ایجاد شد؛ `AuditLogRepository` آن را پیاده‌سازی می‌کند و `AuditLogService` دیگر به concrete repository وابسته نیست.
- `Security/IdempotencyStore.php` و `Security/TransactionBoundary.php` ایجاد شدند؛ repository و transaction manager زیرساختی این قراردادها را پیاده‌سازی می‌کنند و `IdempotencyService` فقط به قراردادها وابسته است.
- اتصال اتمیک سفارش و idempotency به این فرض composition متکی است که Repository سفارش، IdempotencyRepository و TransactionManager همان PDO singleton را از `getConnection()` دریافت می‌کنند؛ این اتصال در Composition Root فعلی برقرار است.

### مغایرت‌های باقی‌مانده
- قراردادهای persistence فعلی هنوز در برخی متدها آرایه‌های خام برمی‌گردانند؛ DTOهای typed و error/result contract نسخه‌بندی‌شده برای کل ماژول‌ها کامل نیست.
- سایر سرویس‌های Backend (مانند Catalog، Inventory، Dining و Finance) هنوز در چند مورد PDO را مستقیم دریافت می‌کنند؛ مرزبندی آن‌ها باید ماژول‌به‌ماژول انجام شود.
- OrderService اکنون از PermissionChecker، ActorContext، BusinessContext و ApplicationException در لایه مشترک استفاده می‌کند و به Auth/Http وابسته نیست. OrderController به‌عنوان HTTP adapter همچنان AuthenticatedPrincipal/BusinessScope را از middleware دریافت و به context مشترک تبدیل می‌کند؛ این وابستگی در مرز transport مجاز است.
- Dependency graph و cycle audit کامل Frontend/Backend هنوز اجرا نشده است.
- logger ساخت‌یافته Backend ایجاد و به HTTP Kernel متصل شده است؛ خروجی JSON به error_log می‌رود، فیلدهای level/event/module/request_id/context دارد و با `POS_V3_LOG_MODULES` قابل فیلتر است. اتصال logger به همه use-caseها، providerها و عملیات دیتابیس هنوز انجام نشده است.
- migrationها در یک پوشه مرکزی و ترتیبی هستند؛ map مالکیت دامنه‌ای باید ثبت و runner از نظر metadata بررسی شود.

این اصلاحات صرفاً از نظر ساختار و قرارداد کد ثبت شده‌اند؛ تست جامع و Build همچنان به دستور کاربر معوق هستند.

## 3) Database و Migration

مسیر مشاهده‌شده: database/v3

- README-FA.md
- bin/
- migrations/
- schema.sql

Migrationهای ترتیبی SQL از 001 تا 012 در GitHub مشاهده شدند؛ مالکیت دامنه‌ای اولیه از روی جداول ایجاد/تغییریافته قابل استخراج است و در سند MIGRATION_OWNERSHIP_MAP.md ثبت می‌شود.

### ارزیابی
- نسخه‌بندی ترتیبی و وجود مسیر migration مثبت است.
- ساختار مشاهده‌شده یک پوشه مرکزی migrations است؛ استقلال مالکیت هر ماژول در ساختار مسیر/metadata هنوز اثبات نشده است.
- فهرست شماره، نام و جداول هر migration استخراج شد؛ مالکیت در سطح دامنه فعلاً طبقه‌بندی اولیه است و نیاز به بازبینی migration-by-migration دارد.
- runner، checksum، ثبت migration اجراشده، اجرای مجدد و رفتار rollback/restore در مرحله تست نهایی بررسی می‌شوند؛ فعلاً تأییدشده تلقی نشوند.

## 4) Logging و Contracts

- logger واقعی frontend در `src/core/observability/logger.ts` قرار دارد؛ logger فعلی console-backed است و کلیدهای حساس مانند password/token/authorization را در object context redacted می‌کند.
- در Backend مسیر `v3/backend` logger مرکزی مستقل در tree پیدا نشد؛ وجود correlation ID در HTTP به‌تنهایی معادل logging ساخت‌یافته مرکزی نیست.
- اتصال logger به AuditLogService و Kernel وجود دارد؛ اتصال eventهای تمام use-caseها، providerها و عملیات دیتابیس هنوز نیازمند بررسی است.
- تا وقتی تمام نقاط ورود API، use-caseها و provider adapters از logger مشترک استفاده نکنند، قانون لاگ متمرکز کامل نیست.
- قراردادهای معماری در چند سند مرزبندی تعریف شده‌اند؛ پوشش قراردادهای executable و versioned برای همه ماژول‌ها اثبات نشده است.

## 5) مستندات و تست مستقل

سندهای مرزبندی برای فروش/سفارش/کاتالوگ، موجودی/رسپی/بهای تمام‌شده، مشتری/وفاداری/پیام‌رسانی، تنظیمات/دسترسی/گزارش، Backend، Migration/Audit، Storefront/Integrations و Licensing ایجاد شده‌اند.

اما:
- مستندات مرزبندی جایگزین README و قرارداد اجرایی هر ماژول نیست.
- ساختار tests مستقل برای همه ماژول‌ها هنوز inventory و تأیید نشده است.
- تست جامع بنا بر دستور کاربر تا پایان مرحله تطبیق کلی معماری اجرا نمی‌شود.

## 6) ترتیب کار باقی‌مانده برای پایان تطبیق

1. استخراج tree کامل و ثبت فهرست همه ماژول‌ها و فایل‌های public/private.
2. تحلیل import/dependency frontend و backend و ثبت cycleها و cross-module leaks.
3. تعیین public entrypoint و قرارداد ورودی/خروجی واقعی برای هر ماژول.
4. تثبیت shared kernel و composition root؛ تکمیل DI و persistence/transaction ports در تمام ماژول‌ها.
5. گسترش logger ساخت‌یافته و correlation context از HTTP Kernel به use-caseها، database و provider adapters.
6. تهیه migration ownership map و تعیین metadata/runner contract.
7. ایجاد الگوی docs/tests و ثبت پوشش مستقل تمام ماژول‌ها.
8. بررسی مرزهای tenant/business/branch، guest actor، central licensing و storefront در برابر مدل فعلی.
9. به‌روزرسانی وضعیت هر قانون به «استاندارد تثبیت‌شده»، «کد منطبق»، «نیازمند refactor» یا «تست معوق».
10. پس از بسته‌شدن همه موارد، اجرای یک‌باره تست جامع معماری و ثبت نتایج.

## 7) وضعیت فعلی

- استاندارد مرجع معماری: تثبیت شد.
- ساختار Feature-Based اولیه: وجود دارد؛ انطباق کامل تأیید نشده.
- جداسازی لایه‌ها: در Orders/Security، PDO از callback کاربردی خارج و persistence/transaction ports اضافه شدند؛ سایر ماژول‌ها هنوز نیازمند refactor هستند.
- قراردادهای ماژول: در اسناد تعریف شده؛ پوشش اجرایی ناقص/نامشخص.
- logging: logger ساخت‌یافته Backend در Kernel فعال و module-filterable است؛ پوشش سراسری تمام ماژول‌ها هنوز ناقص است.
- migration: نسخه‌بندی ترتیبی وجود دارد؛ ownership مستقل نیازمند تعیین است.
- docs/tests: اسناد مرزبندی وجود دارد؛ مستندات و تست مستقل تمام ماژول‌ها تکمیل/تأیید نشده.
- تست نهایی: عمداً معوق تا پایان تطبیق کلی.


## تکمیل مرز Persistence ماژول‌های Backend — 2026-11-25
در commit `0377ac1a67b3cd9b7123a76c1a1d996e449fa8c8`، سرویس‌های کاربردی زیر از PDO و Repository concrete جدا شدند و به persistence portهای متعلق به ماژول وابسته شدند:

- Catalog: `CatalogStore`
- Inventory: `InventoryStore`, `InventoryDocumentStore`, `InventoryPostingStore`, `SupplierStore`
- Dining: `DiningStore`
- Finance: `CashStore`
- Recipes: `RecipeStore`
- Media: `MediaStore`
- Orders: `OrderStore` (در دسته قبلی)

Repositoryهای PDO در `Infrastructure/Database` implementation این interfaceها هستند و Composition Root آن‌ها را به سرویس‌ها تزریق می‌کند. سرویس‌های مذکور دیگر `PDO` را import نمی‌کنند یا از داخل خود Repository نمی‌سازند.

### موارد باز
- `MediaService` هنوز به `PrivateMediaStorage` concrete وابسته است؛ storage port باید استخراج شود.
- ماژول‌های Auth/Access، User/Role management و چند controller/service دیگر هنوز نیازمند بررسی PDO/Repository coupling هستند.
- بعضی سرویس‌ها هنوز `HttpException` و مدل‌های actor/scope متعلق به Auth را مصرف می‌کنند؛ error contract و actor/authorization ports باید مستقل شوند.
- logger مرکزی فعلاً در Kernel برای exceptionهای کنترل‌نشده متصل است؛ log eventهای application و providerها هنوز به آن متصل نشده‌اند.
- این تغییرات از نظر کد ثبت شده‌اند، اما به دلیل دستور کاربر build/lint/test اجرا نشده است؛ سازگاری signatureها و runtime در تست نهایی بررسی خواهد شد.


## گسترش Persistence Ports به Auth/Access — 2026-11-25
- قراردادهای `BusinessStore`, `UserStore`, `RoleStore`, `SessionStore` و `PermissionStore` ایجاد و Repositoryهای PDO متناظر به آن‌ها متصل شدند.
- سرویس‌های BranchManagement، RoleManagement، UserManagement، PermissionService و BusinessScopeResolver و همچنین BusinessContextController، SessionAuthenticator و InstallationOwnerMiddleware به قراردادهای ماژول وابسته شدند.
- `AuthenticationService`، `BusinessSetupService` و `AuthController` نیز از ساخت مستقیم Repository و TransactionManager خارج شدند و قراردادهای Store/TransactionBoundary/AuditLogService دریافت می‌کنند.
- منطق محدودسازی تلاش ورود از `LoginAttemptLimiter` به port به نام `LoginAttemptStore` منتقل شد؛ پیاده‌سازی SQL در `Infrastructure/Database/LoginAttemptRepository` قرار دارد.
- callbackهای تراکنش و idempotency در ماژول‌های اصلاح‌شده دیگر PDO را دریافت نمی‌کنند؛ دسترسی مستقیم PDO به Repositoryها و TransactionManager در Infrastructure محدود شده است.

### مغایرت‌های باقی‌مانده پس از این دسته
- `AuditLogController` هنوز به Repository خواندن ممیزی وابستگی دارد و باید AuditLogReader port بگیرد.
- برخی controllerها و middlewareها هنوز مستقیماً Repository concrete دریافت می‌کنند؛ انتقال آن‌ها به Store interface باید کامل شود.
- وابستگی ماژول‌های کاربردی به `HttpException` و مدل‌های `AuthenticatedPrincipal`/`BusinessScope` از Auth/Http هنوز یک shared application contract مستقل ندارد.
- `AuthController` و برخی controllerهای دیگر هنوز HTTP concerns را در کنار orchestration دارند؛ جداسازی application handler و HTTP adapter ادامه دارد.
- تست و Build عمداً اجرا نشده‌اند؛ تمام تغییرات این دسته در تست نهایی بررسی خواهند شد.


## Dependency Audit — 2026-11-25
- Frontend import audit در فایل‌های feature بررسی‌شده نشان داد featureها فقط shared/api، shared/ui و CSS محلی را import می‌کنند؛ App composition root است.
- Persistence ports برای Auth/Access و ماژول‌های اصلی ایجاد شده‌اند؛ فهرست دقیق و وابستگی‌های باقی‌مانده در `v3/docs/ARCHITECTURE_DEPENDENCY_AUDIT.md` ثبت شده است.
- Migration runner اکنون manifest مالکیت/وابستگی را پیش از اجرای SQL اعتبارسنجی می‌کند.
- README مستقل Backend و Frontend برای ماژول‌ها/features ایجاد شده است.
- در tree فعلی هیچ تست مستقل V3 پیدا نشد؛ این مورد مانع اعلام تطبیق کامل است.


## Shared Application Contracts — 2026-11-25
- `Support/ApplicationException` ایجاد شد؛ `HttpException` برای سازگاری HTTP adapterها subclass آن است و Kernel اکنون ApplicationException را map می‌کند.
- سرویس‌های کاربردی اصلی دیگر HttpException را import نمی‌کنند و از ApplicationException استفاده می‌کنند.
- `Security/PermissionChecker` ایجاد شد؛ OrderService دیگر به PermissionService/Auth implementation وابسته نیست.
- `Security/ActorContext` و `BusinessContext` ایجاد شدند؛ سرویس‌های Orders، Catalog، Inventory، Dining، Finance، Recipes و Media از این contextهای مشترک استفاده می‌کنند و controllerها context را از principal/scope معتبر می‌سازند.
- در فایل‌های سرویس این ماژول‌ها، importهای Auth/Http/Infrastructure/PDO حذف شده‌اند. نتیجه static inspection است و هنوز runtime test نشده است.
- ماتریس وضعیت شش قانون در `v3/docs/ARCHITECTURE_CONFORMANCE_MATRIX.md` ثبت شده است.


## بازبینی مرز سرویس‌های کاربردی — 2026-11-26
- وابستگی concrete به AuditLogService و IdempotencyService از سرویس‌های کاربردی Auth، Catalog، Dining، Finance، Inventory، Recipes، Media و Orders حذف شد.
- محدودیت باقی‌مانده: IdempotencyExecutor و IdempotencyStore هنوز actorUserId عددی می‌گیرند؛ GuestActorContext وجود دارد اما هنوز در idempotency persistence قابل استفاده نیست. این تغییر نیازمند طراحی actor kind/key و migration افزایشی جدید است و باید پیش از اجرای guest checkout انجام شود.
- قراردادهای Security/AuditRecorder و Security/IdempotencyExecutor اکنون مرز مشترک این ماژول‌ها هستند و سرویس‌های اجرایی Security پیاده‌ساز آن‌ها هستند.
- تست‌های معماری ماژول‌های مربوطه برای ممنوعیت وابستگی مستقیم به این کلاس‌های concrete تقویت شدند.
- MediaService از قبل از MediaStorage interface استفاده می‌کرد؛ PrivateMediaStorage در Infrastructure adapter باقی می‌ماند.
- این بررسی فقط کد و import/type declarations را تأیید کرده است؛ هنوز تست یا Build اجرا نشده است.


## تکمیل قراردادهای امنیتی مشترک — 2026-11-26
- علاوه بر AuditRecorder و IdempotencyExecutor، قرارداد LoginAttemptGuard اضافه شد.
- AuthenticationService وابستگی به LoginAttemptLimiter concrete را کنار گذاشت؛ Security/LoginAttemptLimiter این interface را پیاده‌سازی می‌کند.
- تست معماری Auth و Security به این مرزها اضافه شد.
- Guest idempotency همچنان باز است: schema و port فعلی actor_user_id اجباری دارند و باید در یک migration افزایشی جداگانه برای actor type/key بازطراحی شوند؛ این کار پیش از اجرای guest checkout لازم است.
