# استاندارد نهایی تطبیق معماری — POS V3

> وضعیت: استاندارد معماری مرجع و معیار پذیرش برای تمام پیاده‌سازی‌های بعدی. این سند به‌تنهایی ادعای تکمیل refactor اجرایی، تست یا صحت production ندارد.

## 1) اصول غیرقابل‌مذاکره

1. معماری ماژولار و Feature-Based؛ هر قابلیت تجاری مالک مشخص، ورودی/خروجی مشخص و مرز وابستگی مشخص دارد.
2. جداسازی UI، Application/Business، Domain، Infrastructure و Persistence؛ جزئیات فنی نباید به لایه‌های بالاتر نشت کند.
3. تمام ارتباط‌های بین ماژول‌ها از قرارداد عمومی/DTO/Port انجام می‌شود؛ import مستقیم فایل داخلی یا Repository ماژول دیگر ممنوع است.
4. لاگ متمرکز، ساخت‌یافته، قابل فیلتر بر اساس module، level، event و correlation/request ID؛ داده حساس و credential ممنوع.
5. Migration مستقل، نسخه‌بندی‌شده، ترتیبی، قابل اجرا روی نصب تازه و ارتقا؛ مالک هر migration مشخص است.
6. هر ماژول مستندات مستقل، قراردادهای قابل بررسی و تست مستقل دارد؛ تست‌ها در انتهای مرحله تطبیق کلی اجرا می‌شوند، مگر بررسی بحرانی لازم باشد.

## 2) ساختار مرجع ماژول

ساختار پیشنهادی برای قابلیت‌های frontend:

```text
src/modules/<module>/
  index.ts                 # تنها public entrypoint
  manifest.ts              # شناسه، نسخه قرارداد، قابلیت‌ها
  contracts/               # DTO، input/output، event types
  application/             # use-cases، orchestration
  domain/                  # entity، value object، policy
  infrastructure/          # API adapters، provider adapters
  ui/                      # screen، components، view-model
  tests/                   # unit، contract، integration
  docs/                    # README، decisions، workflows
```

ساختار مرجع Backend:

```text
backend/src/<Module>/
  Contracts/               # interfaces، DTO، event contracts
  Application/             # use-cases و transaction orchestration
  Domain/                  # rules، value objects، state transitions
  Infrastructure/          # PDO repositories و external adapters
  Http/                    # controllers و request/response mapping
  Tests/                   # tests متعلق به ماژول
```

این ساختار الزام به ایجاد پوشه خالی برای هر بخش نیست؛ فقط لایه‌ای که مسئولیت واقعی دارد ایجاد می‌شود. نام‌گذاری فعلی پروژه می‌تواند در مهاجرت تدریجی حفظ شود، به شرط رعایت مرزها.

## 3) قانون وابستگی و مالکیت

- UI فقط public entrypoint ماژول، design system و API client مشترک را مصرف می‌کند.
- UI مستقیماً SQL، PDO، Repository یا provider SDK را نمی‌شناسد.
- Application مجاز به فراخوانی Domain و Portهای تعریف‌شده است؛ به پیاده‌سازی PDO یا React وابسته نیست.
- Domain هیچ وابستگی به HTTP، React، PDO، filesystem یا provider SDK ندارد.
- Infrastructure قراردادهای تعریف‌شده در لایه‌های بالاتر را پیاده‌سازی می‌کند.
- Controller فقط HTTP را parse/validate و به use-case واگذار می‌کند؛ business rule در controller ممنوع.
- Repository فقط persistence/query است و workflow تجاری را orchestrate نمی‌کند.
- ماژول دیگر فقط از public contract یا application port استفاده می‌کند؛ دسترسی مستقیم به repository و private implementation ممنوع.
- چرخه وابستگی بین ماژول‌ها ممنوع؛ وابستگی مشترک باید به shared kernel محدود و کوچک منتقل شود.
- Bootstrap/Composition Root تنها محل ساخت و تزریق implementationها است.

## 4) قرارداد ورودی/خروجی

برای هر use-case عمومی، این موارد الزامی است:
- نام و شناسه پایدار عملیات؛
- Input DTO با نوع، محدودیت، required/optional و validation؛
- Output DTO با شکل پاسخ مشخص؛
- خطاهای دامنه‌ای با machine-readable code و پیام امن؛
- actor، tenant/business/branch scope و correlation context در عملیات لازم؛
- سیاست authorization و entitlement در سمت سرور؛
- سیاست idempotency برای عملیات نوشتنی حساس؛
- نسخه قرارداد و سیاست سازگاری.

قراردادها نباید PDO، Request/Response فریم‌ورک، React component، provider response خام یا secret را افشا کنند. تغییر ناسازگار باید نسخه جدید یا adapter سازگار داشته باشد.

## 5) رویدادها و ارتباط بین ماژول‌ها

- رویدادهای دامنه نام‌گذاری‌شده، نسخه‌دار و دارای payload محدود تعریف شوند.
- انتشار event به معنی انتقال مالکیت داده نیست؛ هر ماژول منبع حقیقت داده خودش است.
- برای عملیات هم‌زمان و اتمیک، use-case هماهنگ‌کننده و transaction boundary روشن لازم است.
- عملیات async باید شناسه پیام، retry policy، deduplication و وضعیت نهایی قابل مشاهده داشته باشد.
- از event bus یا abstraction عمومی بدون نیاز واقعی استفاده نشود؛ ابتدا قرارداد ساده و قابل تست.

## 6) Logging و Observability

حداقل فیلدهای ساخت‌یافته:
- timestamp، level، message/event_code؛
- module، component، operation؛
- correlation_id و در صورت وجود request_id؛
- environment و safe context؛
- exception class و safe error code.

الزامات:
- فیلتر بر اساس module، level، event_code و correlation_id.
- correlation ID در مرز HTTP ساخته/اعتبارسنجی و در پاسخ بازتاب داده شود.
- secret، password، token، cookie، authorization header، API key و داده پرداخت خام ثبت نشود.
- شماره تماس، ایمیل و اطلاعات مشتری در صورت نیاز فقط با redaction/masking.
- خطای provider نباید credential یا response حساس را وارد log کند.
- log نباید منبع حقیقت وضعیت سفارش/پرداخت/موجودی باشد؛ audit و domain ledger جدا هستند.

## 7) Database و Migration

- هر migration شناسه ترتیبی/نسخه یکتا، مالک ماژول، شرح، پیش‌نیاز و checksum دارد.
- migration پس از انتشار immutable است؛ اصلاح با migration جدید انجام می‌شود.
- runner باید migrationهای اجراشده را ثبت کند و اجرای مجدد را امن/قابل تشخیص سازد.
- نصب تازه و ارتقای نسخه موجود هر دو مسیر رسمی‌اند.
- migration ماژول نباید بدون قرارداد و هماهنگی، جدول/ستون تحت مالکیت ماژول دیگر را تغییر دهد.
- تغییر cross-module با migration هماهنگ و مستند انجام می‌شود؛ ترتیب وابستگی صریح است.
- destructive migration نیازمند مرحله deprecation، backup و rollback/restore plan است.
- هر جدول باید مالک دامنه، کلیدها، scope، indexها و سیاست حذف/نگهداری مشخص داشته باشد.
- tenant/customer database isolation و business/branch scoping دو کنترل جدا هستند و هر دو باید در مسیر داده رعایت شوند.

## 8) مستندات و تست مستقل هر ماژول

هر ماژول باید حداقل داشته باشد:
- README: مسئولیت، مالکیت داده و public entrypoint؛
- CONTRACTS: ورودی/خروجی و خطاها؛
- DEPENDENCIES: وابستگی مجاز و ممنوع؛
- MIGRATIONS: فهرست migrationهای مالکیت‌شده؛
- TESTS: unit، contract و integration مناسب؛
- OPERATIONS: logging، config/secrets و failure/retry behavior؛
- ADR برای تصمیم معماری مهم.

تست‌ها باید بدون بالا آوردن کل سامانه تا حد ممکن اجرا شوند. تست قرارداد برای public API و تست integration برای مرز DB/provider لازم است. تست سراسری همچنان در پایان تطبیق کلی اجرا می‌شود.

## 9) Feature-based و قابلیت‌های تجاری

- feature flag صرفاً نمایش UI را کنترل نمی‌کند؛ Backend نیز باید entitlement و permission را enforce کند.
- plan/entitlement از تنظیمات محلی مشتری و از central licensing تفکیک شود.
- خاموش‌شدن feature نباید داده موجود را حذف کند.
- محدودیت‌های پلن باید در application boundary و با خطای مشخص اعمال شوند.
- هر ماژول باید رفتار حالت disabled و داده‌های تاریخی خود را تعریف کند.

## 10) مرزهای دامنه اولیه V3

- Platform/Core: configuration، identity، authorization، observability، migration، licensing integration.
- POS/Sales: سبد و orchestration فروش؛ مالک order lifecycle نیست.
- Orders/Fulfillment: lifecycle سفارش، کانال، وضعیت و idempotency.
- Catalog/Menu: محصول، دسته، گزینه‌ها و قیمت پایه.
- Inventory: ledger، اسناد، posting و reversal.
- Recipes/Costing: recipe version، مصرف و snapshot هزینه.
- Customers/CRM: پروفایل و consent.
- Loyalty: امتیاز و redemption ledger.
- Messaging/Campaigns: provider adapters، template، dispatch و campaign.
- Finance/Cash: cash session، cash movement و reconciliation.
- Reporting: read modelهای scoped و read-only.
- Storefront: public catalog projection، cart/checkout و guest order؛ از همان Orders application use-case مشترک استفاده می‌کند.
- Integrations: WooCommerce و سایر providerها از adapter و sync contract.
- Licensing/Central Admin/Updater: کنترل تجاری مرکزی و lifecycle لایسنس/انتشار؛ نباید به دیتابیس عملیاتی مشتریان وابسته مستقیم داشته باشد.

## 11) امنیت و چندمشتری

- در نصب اختصاصی، دیتابیس مستقل هر مشتری مرز جداسازی پایه است.
- در هر درخواست عملیاتی، business/branch scope از context معتبر سمت سرور استخراج می‌شود؛ از payload مرورگر اعتماد نمی‌شود.
- public storefront از slug/domain منتشرشده به scope معتبر resolve می‌شود؛ browser مجاز به تعیین business_id/branch_id نیست.
- guest actor یک هویت نوع‌دار مستقل است؛ ساخت user جعلی یا دورزدن middleware ممنوع.
- قیمت، تخفیف، مالیات، هزینه ارسال، موجودی و وضعیت ساعات کاری در سمت سرور محاسبه/اعتبارسنجی می‌شود.
- پنل مرکزی فقط اطلاعات لازم برای licensing/entitlement/updates را می‌بیند؛ داده عملیاتی فروش مشتری در central DB جمع‌آوری نمی‌شود مگر تصمیم صریح و مستند جدید.

## 12) معیار پایان «تطبیق معماری»

تطبیق معماری فقط زمانی کامل اعلام می‌شود که:
1. inventory تمام ماژول‌ها و dependency graph واقعی تهیه شده باشد.
2. هر ماژول مالک، public entrypoint، قرارداد و لایه‌های خود را داشته باشد.
3. importهای ممنوع و dependency cycleها حذف شده یا برای هر مورد باقی‌مانده برنامه و مهلت ثبت شده باشد.
4. logger مرکزی و correlation context به همه مرزهای فعال متصل باشد.
5. مالکیت و ترتیب migrationها ثبت و runner از نظر طراحی مشخص باشد.
6. الگوی docs/tests برای تمام ماژول‌ها آماده و پوشش ماژول‌ها ثبت شده باشد.
7. مرزهای tenant، business، branch، guest actor و central licensing مشخص و بدون ابهام باشند.
8. workplan هر مورد را به یکی از وضعیت‌های «استاندارد تثبیت‌شده»، «کد منطبق»، «نیازمند refactor» یا «تست معوق» نسبت دهد.

پس از تکمیل این تطبیق، یک مرحله تست جامع معماری اجرا می‌شود: typecheck/build، PHP lint، dependency/cycle audit، contract tests، migration fresh-install/upgrade، tenant/scope isolation و integration smoke tests. تا پایان این مرحله هیچ ادعای «تطبیق کامل و تأییدشده» صادر نمی‌شود.

## 13) تصمیم اجرایی

تا زمانی که کاربر اعلام نکرده مرحله تطبیق معماری تمام شده، توسعه featureهای جدید متوقف می‌ماند. کار مجاز در این مرحله: inventory، تکمیل قراردادها، اصلاح ساختار پایه و رفع مغایرت‌های معماری است. تست جامع و build به انتهای تطبیق کلی موکول است؛ فقط بررسی بحرانی محدود برای جلوگیری از تغییر خطرناک مجاز است.
