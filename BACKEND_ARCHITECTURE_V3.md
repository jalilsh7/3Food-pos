# معماری Backend تجاری POS V3

- وضعیت: **قرارداد معماری مصوب برای پیاده‌سازی؛ هنوز Backend عملیاتی ایجاد نشده است.**
- دامنه: POS V3 مستقل از runtime و دیتابیس V2؛ نصب روی PHP 8.2+ و MySQL/MariaDB پشتیبانی‌شده.
- شاخه توسعه: `feature/3food-pos-next-release-v2`.
- اصل بنیادین: مرورگر/Frontend قابل اعتماد نیست؛ احراز هویت، مجوز، قیمت، موجودی، وضعیت سفارش و تمام اثرات مالی فقط در سرور معتبر می‌شوند.

## 1. مرزبندی و ساختار

Backend در مسیر مستقل `v3/backend/` ساخته می‌شود. ابزارهای نصب و نگهداری دیتابیس در `database/v3/bin/` باقی می‌مانند و مسئولیت HTTP runtime را بر عهده نمی‌گیرند. هیچ include، autoload، اتصال DB، session یا منطق دامنه از runtime V2 مجاز نیست.

ساختار هدف:

```text
v3/backend/
  public/index.php
  bootstrap.php
  src/
    Application/
    Domain/
    Http/
    Infrastructure/
    Security/
    Support/
  tests/
  composer.json
```

این ساختار هدف است؛ ایجاد فایل‌ها و dependencyها در بسته‌های بعدی و پس از بررسی سازگاری انجام می‌شود. Composer/lockfile فقط با نسخه‌های واقعی و قابل نصب اضافه خواهد شد؛ هیچ نسخه فرضی یا dependency بدون نیاز ثبت نمی‌شود.

## 2. قرارداد HTTP و API

- پیشوند نسخه: `/api/v1`; تغییر ناسازگار فقط در نسخه بعدی.
- بدنه و پاسخ JSON با UTF-8؛ `Content-Type: application/json`.
- درخواست نامعتبر با 400/422، احراز هویت لازم با 401، عدم مجوز با 403، منبع ناموجود با 404، تعارض دامنه/نسخه با 409، محدودیت نرخ با 429 و خطای غیرمنتظره با 500 پاسخ داده شود.
- پاسخ موفق یکنواخت: `{ "data": ..., "meta": ... }`; پاسخ خطا: `{ "error": { "code": "...", "message": "...", "details": ..., "request_id": "..." } }`.
- جزئیات داخلی، stack trace، SQL، مسیر فایل و secret هرگز به مشتری API بازگردانده نشود.
- pagination محدود و صریح باشد؛ sort/filter فقط از allowlist فیلدهای تعریف‌شده پذیرفته شوند.
- ورودی JSON با محدودیت اندازه، نوع، طول و قواعد دامنه validate شود؛ mass assignment و اعتماد به فیلدهای ناشناخته ممنوع.
- هر درخواست دارای request/correlation ID باشد و در logها با آن قابل پیگیری شود.

## 3. احراز هویت و نشست

- احراز هویت فقط سمت سرور و با حساب‌های ذخیره‌شده در DB انجام شود؛ رمز با `password_hash()` و `password_verify()` مدیریت شود.
- رمز خام، token و session identifier در log، audit یا پاسخ API ذخیره نشوند.
- نشست مبتنی بر cookie امن و ترجیحاً opaque server-side باشد؛ cookie با `Secure` در HTTPS، `HttpOnly` و `SameSite=Lax` یا سیاست سخت‌گیرانه‌تر تنظیم شود.
- پس از login و تغییر سطح دسترسی، شناسه نشست rotate شود؛ logout، انقضا، لغو نشست و تغییر رمز امکان revoke نشست‌های قبلی را داشته باشند.
- session fixation، brute force و enumeration با پاسخ‌های عمومی، throttling و تاخیر/قفل کنترل‌شده مهار شوند.
- CSRF token برای درخواست‌های تغییردهنده state در مدل cookie-session اجباری است؛ بررسی Origin/Referer مکمل آن است، نه جایگزین.
- reset password باید token تصادفی یک‌بارمصرف، hash‌شده در DB، کوتاه‌عمر و دارای invalidation نشست باشد؛ ارسال ایمیل/SMS تا انتخاب provider واقعی پیاده‌سازی نمی‌شود.
- هیچ credential پیش‌فرض یا master password ثابت در کد وجود نداشته باشد.

## 4. RBAC و محدوده داده

- مجوزها با کدهای پایدار مانند `orders.read`، `orders.create`، `orders.cancel`، `finance.cash.close` و `settings.update` تعریف شوند؛ نام نقش به‌تنهایی مجوز نیست.
- کاربر می‌تواند چند نقش داشته باشد؛ permissionها در سمت سرور resolve و در هر endpoint و service حساس enforce شوند.
- scope کسب‌وکار و شعبه (business/branch) در query و command اجباری باشد؛ شناسه رکورد ارسالی کاربر مجوز دسترسی به آن رکورد نیست.
- اصل least privilege؛ deny-by-default؛ عدم اتکا به مخفی‌کردن دکمه در UI.
- تغییر نقش/مجوز، دسترسی بین شعبه‌ای و عملیات حساس audit شود.
- مجوز مالک/مدیر نیز از policy صریح عبور کند؛ مسیر bypass مخفی ممنوع.

## 5. لایه دامنه و تراکنش

- HTTP Controller فقط parse/validate اولیه، احراز هویت و فراخوانی Application Service را انجام می‌دهد.
- Domain قواعد تجاری را مستقل از HTTP و UI نگه می‌دارد؛ Repository/Infrastructure جزئیات PDO و SQL را پنهان می‌کند.
- PDO با prepared statements؛ نام ستون، جدول، sort و قطعات SQL از ورودی کاربر ساخته نمی‌شوند.
- تراکنش در مرز use-case/service تعریف می‌شود؛ تمام نوشتن‌های وابسته (سفارش، snapshot، رزرو، ledger، audit/outbox) یا با هم commit می‌شوند یا rollback.
- عملیات هم‌زمان با unique constraint، قفل ردیف/نسخه و کنترل optimistic یا pessimistic مناسب مدیریت شوند؛ فقط بررسی قبل از نوشتن کافی نیست.
- رویدادهای مالی و گردش موجودی append-only هستند؛ اصلاح با reversal/adjustment جدید، نه UPDATE/DELETE سابقه.
- وضعیت سفارش، وضعیت پرداخت، آماده‌سازی و تحویل مستقل می‌مانند.

## 6. قیمت، سفارش و موجودی

- Frontend فقط شناسه محصول/variant/option، تعداد، انتخاب و ورودی مجاز تخفیف را ارسال می‌کند؛ مبلغ واحد/جمع/مالیات/ارسال ارسالی مرجع نیست.
- سرور قیمت جاری، وضعیت فروش، گزینه‌های مجاز و قیمت آن‌ها، تخفیف و محدودیت آن، مالیات/هزینه‌ها و دسترسی actor را دوباره محاسبه می‌کند.
- snapshot تغییرناپذیر در سفارش شامل نام/شناسه مرجع، قیمت پایه، گزینه‌ها و قیمت آن‌ها، تعداد، تخفیف تخصیص‌یافته، مالیات/هزینه و currency/precision policy است.
- موجودی قابل فروش و رزرو در تراکنش سرور و با قفل/شرط اتمیک کنترل شود؛ UI فقط بازتاب نتیجه است.
- تغییر قیمت بعدی نباید snapshot سفارش ثبت‌شده را تغییر دهد.

## 7. Idempotency و کنترل تکرار

- endpointهای ایجاد سفارش، پرداخت، refund، گردش صندوق/انبار و commandهای حساس کلید idempotency اجباری دارند.
- کلید در scope actor/business/endpoint یا منبع مناسب یکتا می‌شود و همراه hash درخواست و نتیجه نهایی ثبت می‌شود.
- استفاده مجدد از همان کلید با payload متفاوت با 409 رد می‌شود؛ همان payload نتیجه قبلی را برمی‌گرداند.
- idempotency record و اثر دامنه در یک تراکنش ثبت شوند؛ unique constraint آخرین خط دفاع است.
- برای callback/provider خارجی، شناسه رویداد provider و محدودیت تکرار مستقل ثبت شود.

## 8. Audit، خطا و مشاهده‌پذیری

- audit append-only با actor، business/branch، action، entity، زمان UTC، request ID، نتیجه و حداقل metadata لازم ثبت شود.
- رمز، session/token، اطلاعات پرداخت حساس و داده شخصی غیرضروری در audit/log ثبت نشوند.
- audit عملیات حساس باید با همان تراکنش دامنه commit شود؛ خطای ثبت audit نباید عملیات حساس را بی‌ردپا باقی بگذارد.
- خطاهای دامنه به کدهای پایدار و HTTP مناسب نگاشت شوند؛ exception غیرمنتظره به پاسخ عمومی 500 و log امن تبدیل شود.
- log ساختاریافته، سطح‌بندی‌شده و بدون secret؛ نمایش جزئیات فقط در محیط توسعه امن.

## 9. پیکربندی و امنیت عملیاتی

- secrets فقط از environment أو فایل خارج از public web root با permission محدود خوانده شوند؛ هیچ secret در Git، frontend build یا پاسخ API قرار نگیرد.
- startup config validation الزامی است؛ نبود DB credentials، secret لازم یا تنظیم امنیتی باید fail-fast شود.
- HTTPS در production، محدودیت CORS با allowlist، security headers، محدودیت body و timeoutها لازم‌اند.
- rate limit برای login، reset، endpoint عمومی storefront و عملیات پرهزینه؛ کلید محدودسازی باید پشت proxy فقط از IP قابل اعتماد استخراج شود.
- public endpointها فقط DTO و فیلدهای مجاز را expose کنند؛ enumeration شناسه‌ها، دسترسی cross-tenant و اطلاعات خصوصی مشتری ممنوع.
- health/readiness endpoint اطلاعات حساس یا نسخه/پیکربندی محرمانه افشا نکند.

## 10. تست و دروازه پذیرش

- unit برای Domain، contract tests برای API، integration tests برای PDO و MySQL/MariaDB، security tests برای auth/RBAC/CSRF/rate limit و concurrency tests برای idempotency/stock/finance لازم‌اند.
- تست‌های دیتابیس باید روی MySQL 8.0.16+ و MariaDB 10.6+ واقعی اجرا شوند؛ SQLite جایگزین پذیرش این دو engine نیست.
- تست فقط زمانی PASS اعلام می‌شود که runner واقعاً step را اجرا کرده باشد؛ runner_id=0 یا نبود log یعنی اجرا نشده.
- اتصال Frontend به API تا عبور قرارداد، auth، RBAC، validation، خطا و تست integration انجام نمی‌شود.

## 11. ترتیب بسته‌های اجرایی

1. BE-01A: bootstrap/config و مرز runtime مستقل.
2. BE-01B: HTTP Request/Response/Router و قرارداد خطا.
3. BE-01C: PDO factory، transaction manager و repository پایه.
4. BE-01D: authentication/session/CSRF/throttling.
5. BE-01E: RBAC و business/branch scope.
6. BE-01F: audit و idempotency.
7. BE-01G: اولین vertical slice سفارش فقط پس از تکمیل قراردادهای فوق.

**وضعیت فعلی:** این سند قرارداد معماری است؛ هیچ API عملیاتی، login، session، RBAC یا endpoint در این commit ایجاد نمی‌شود.


## 12. اجرای قرارداد HTTP — BE-01B
- ورودی HTTP به Request immutable تبدیل می‌شود؛ headerها lowercase، مسیر بدون query string، و request ID ورودی فقط با allowlist محدود پذیرفته می‌شود؛ در غیر این صورت شناسه تصادفی تولید می‌شود.
- JSON body فقط object است؛ JSON نامعتبر یا آرایه با 400 رد می‌شود. بدنه خالی به object خالی تبدیل می‌شود.
- Router فقط routeهای صریح ثبت‌شده را dispatch می‌کند؛ پارامترهای مسیر decode و کنترل می‌شوند؛ path ناموجود 404 و method نامعتبر برای path شناخته‌شده 405 است.
- پاسخ موفق `data/meta` و پاسخ خطا `error` است؛ همه پاسخ‌ها request ID را در header `X-Request-ID` دارند.
- خطای شناخته‌شده با status/code/message امن نگاشت می‌شود؛ Throwable غیرمنتظره فقط class و request ID را در log ثبت می‌کند و پاسخ عمومی 500 می‌دهد.
- `GET /api/v1/health` صرفاً liveness است و اتصال DB، آمادگی سرویس یا صحت schema را ادعا نمی‌کند.
- این مرحله authentication، authorization، CORS، CSRF، rate limiting، body-size enforcement و endpoint دامنه را هنوز پیاده نکرده است؛ هیچ route تجاری/حساس نباید پیش از تکمیل middlewareهای امنیتی اضافه شود.


## 13. دسترسی دیتابیس و مرز تراکنش — BE-01C
- اتصال عملیاتی فقط از `PdoConnectionFactory` و configuration اعتبارسنجی‌شده ساخته می‌شود؛ DSN فقط host/port/database و charset utf8mb4 دارد و credential در DSN قرار نمی‌گیرد.
- `pdo_mysql` الزامی است؛ PDO روی exception mode، associative fetch، native prepared statements و timeout محدود تنظیم می‌شود.
- host فقط از مجموعه کاراکترهای DNS/IP مجاز تشکیل می‌شود تا DSN injection از طریق delimiter ممکن نباشد؛ نام DB نیز allowlist محدود دارد.
- خطای اتصال با پیام عمومی به لایه بالاتر می‌رود؛ log فقط SQLSTATE را نگه می‌دارد و متن exception/credential افشا نمی‌شود.
- `TransactionManager` مرز تراکنش یک use-case را مدیریت می‌کند؛ nested transaction را رد می‌کند؛ در exception rollback می‌کند و خطای rollback را بدون پوشاندن خطای اصلی log می‌کند.
- Repositoryها باید prepared statement استفاده کنند؛ ورودی کاربر برای ساخت SQL identifier یا fragment قابل قبول نیست.
- تست فعلی فقط DSN و guardهای پیکربندی را بررسی می‌کند؛ اتصال واقعی MySQL/MariaDB و رفتار commit/rollback هنوز با engine واقعی آزمایش نشده است.


### BE-01C follow-up hardening
- Front controller bootstrap-failure fallback پاسخ 503 را بدون اتکا به autoloader یا کلاس‌های Backend تولید می‌کند؛ بنابراین حتی اگر PHP پایین‌تر از حداقل نسخه باشد یا autoload هنوز راه نیفتاده باشد، fallback JSON خودش fatal error ایجاد نمی‌کند.


## 14. ذخیره‌سازی نشست کاربر — BE-01D1
- migration افزایشی `001_create-user-sessions.sql` جدول `app_user_sessions` را ایجاد می‌کند؛ baseline موجود دست‌نخورده است.
- فقط SHA-256 token hash و CSRF token hash در DB ذخیره می‌شوند؛ token خام فقط یک‌بار به کلاینت تحویل می‌شود.
- نشست به `app_users` متصل است و `session_version` snapshot دارد؛ غیرفعال‌شدن کاربر یا تغییر session_version نشست قبلی را نامعتبر می‌کند.
- انقضا، لغو یک نشست و لغو همه نشست‌های کاربر پشتیبانی می‌شوند.
- `SessionRepository` فقط prepared statements دارد و نشست منقضی/لغوشده/کاربر غیرفعال یا session_version ناسازگار را فعال برنمی‌گرداند.
- migration هنوز اجرا نشده است؛ login endpoint و cookie/CSRF middleware تا تکمیل login throttling، session lifecycle و امنیت HTTP منتشر نمی‌شوند.


## 15. احراز هویت و محدودسازی تلاش ورود — BE-01D2
- `POS_V3_APP_KEY` یک secret مستقل با حداقل ۳۲ بایت است؛ برای HMAC شناسه تلاش ورود استفاده می‌شود و نباید در Git یا frontend قرار گیرد.
- migration `002_create-auth-login-attempts.sql` جدول rate-limit پایدار را اضافه می‌کند؛ کلید رکورد HMAC نام کاربری نرمال‌شده و IP است.
- سیاست اولیه login: پنج تلاش ناموفق در پنجره ۱۵ دقیقه‌ای، سپس block برای ۱۵ دقیقه؛ queryهای هم‌زمان با row lock serialize می‌شوند.
- AuthenticationService با password_verify، hash dummy برای username ناموجود، رد کاربر غیرفعال، rehash رمز پس از ورود موفق و ساخت token تصادفی ۲۵۶ بیتی کار می‌کند.
- فقط SHA-256 نشست و CSRF token در DB ذخیره می‌شود؛ token خام برای صدور cookie/response به caller برگردانده می‌شود.
- SessionRepository و login limiter از prepared statements و TransactionManager استفاده می‌کنند.
- این سرویس هنوز به HTTP route متصل نشده؛ cookie امن، CSRF middleware، session authentication و logout باید پیش از انتشار route تکمیل شوند.


### BE-01D2 follow-up — محدودسازی مستقل حساب و IP
- login limiter دو bucket مستقل و domain-separated با HMAC دارد: حساب کاربری و IP منبع.
- حد حساب پنج شکست و حد IP سی شکست در پنجره ۱۵ دقیقه‌ای است؛ هر bucket پس از رسیدن به حد برای ۱۵ دقیقه مسدود می‌شود.
- موفقیت ورود bucket حساب را پاک می‌کند، اما bucket IP باقی می‌ماند تا تلاش برای password spraying از همان IP قابل محدودسازی باشد.
