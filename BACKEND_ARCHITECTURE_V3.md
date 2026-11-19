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


## 16. Session middleware و CSRF — BE-01D3
- Router از pipeline middleware با ترتیب ثبت‌شده پشتیبانی می‌کند؛ middleware قبل از handler اجرا می‌شود و Request attributeهای immutable دارد.
- `SessionAuthenticator` فقط cookie با نام `pos_v3_session` را می‌پذیرد؛ token با الگوی ثابت validate و SHA-256 آن برای lookup نشست فعال استفاده می‌شود.
- نشست منقضی/لغوشده، کاربر غیرفعال و session_version قدیمی رد می‌شوند.
- `SessionMiddleware` principal را به Request context اضافه می‌کند؛ `CsrfMiddleware` principal را اجباری می‌کند و برای POST/PUT/PATCH/DELETE توکن header `X-CSRF-Token` را با hash ذخیره‌شده مقایسه می‌کند.
- GET/HEAD/OPTIONS از CSRF token مستثنا هستند؛ تغییر state باید از method غیرایمن استفاده کند.
- cookie با ترتیب صحیح Set-Cookie و ویژگی‌های Path=/، HttpOnly، SameSite=Lax و Secure در حالت امن صادر می‌شود؛ logout cookie را با Max-Age=0 منقضی می‌کند.
- middlewareها هنوز به route تجاری وصل نشده‌اند؛ هر route حساس باید SessionMiddleware و سپس CsrfMiddleware را ثبت کند.


## 13. BE-01D4 — اجرای API احراز هویت و نشست (2026-11-20)

- endpointهای \`POST /api/v1/auth/login\`، \`GET /api/v1/auth/me\` و \`POST /api/v1/auth/logout\` در front controller ثبت شدند.
- اتصال PDO lazy است؛ \`GET /api/v1/health\` برای liveness به دیتابیس وابسته نشده است.
- login فقط JSON object می‌پذیرد، Content-Type را enforce می‌کند و قبل از بررسی رمز، same-origin را با Origin/Referer و Host کنترل می‌کند.
- login از AuthenticationService و limiter دو bucket حساب/IP استفاده می‌کند؛ token نشست فقط در cookie \`pos_v3_session\` با HttpOnly، SameSite=Lax و Secure در محیط‌های غیرمحلی قرار می‌گیرد.
- CSRF token در cookie جداگانه \`pos_v3_csrf\` بدون HttpOnly قرار می‌گیرد؛ مقدار خام فقط به کلاینت همان نشست تحویل می‌شود و hash آن در DB می‌ماند. logout برای هر دو cookie header مستقل Set-Cookie می‌فرستد.
- \`GET /auth/me\` نشست را resolve می‌کند و در صورت نبود/نامعتبر بودن CSRF cookie، token جدید ایجاد و hash آن را در همان session جایگزین می‌کند تا بازیابی پس از refresh ممکن باشد.
- logout به ترتیب SessionMiddleware، CsrfMiddleware و SameOriginGuard را اجرا می‌کند؛ session revoke و هر دو cookie پاک می‌شوند.
- CSRF برای درخواست‌های تغییردهنده state تطبیق سه‌گانه header، cookie و hash دیتابیس را enforce می‌کند.
- session lifetime در بازه ۳۰۰ تا ۸۶۴۰۰ ثانیه enforce شده است. JSON body حداکثر ۶۴ KiB خوانده می‌شود.
- درخواست IP از \`REMOTE_ADDR\` گرفته می‌شود؛ \`X-Forwarded-For\` بدون پیکربندی proxy مورد اعتماد استفاده نمی‌شود.
- این مرحله endpointهای auth را ثبت می‌کند، اما RBAC هنوز روی routeها اعمال نشده و هیچ route عملیاتی کسب‌وکار وجود ندارد. تا تکمیل RBAC و scope، از این endpointها برای اتصال UI عملیاتی فراتر از login/session استفاده نشود.
- تست‌های اجرایی عمداً به انتهای پروژه موکول شده‌اند؛ هیچ ادعای lint، CI، DB migration یا integration PASS در این مرحله وجود ندارد.


## 14. BE-01E1 — RBAC و محدوده کسب‌وکار/شعبه

- migration افزایشی 003_create-business-scope-and-rbac.sql جداول pos_businesses، pos_branches، app_user_business_roles و app_user_branch_roles را تعریف می‌کند؛ baseline تغییر نمی‌کند.
- نقش‌های سراسری موجود فقط برای مالک نصب استفاده می‌شوند؛ wildcard فقط برای نقش سیستمی owner seed می‌شود. سایر نقش‌ها در سطح کسب‌وکار یا شعبه انتساب می‌گیرند.
- permission codeها مستقل و صریح‌اند؛ نقش‌های پایه manager، cashier، kitchen، inventory، accountant و waiter در migration تعریف می‌شوند.
- PermissionRepository فقط permission فعال را از role فعال و mapping صریح می‌خواند؛ PermissionService به‌صورت deny-by-default عمل می‌کند.
- BusinessScopeResolver شناسه عمومی UUID کسب‌وکار و شعبه را از headerهای X-Business-ID و X-Branch-ID resolve می‌کند؛ branch باید متعلق به business انتخابی و فعال باشد.
- PermissionMiddleware ابتدا principal نشست را لازم دارد، scope را resolve می‌کند، permission را کنترل می‌کند و BusinessScope معتبر را به Request attribute اضافه می‌کند.
- مجوز business-level از roleهای همان business و مجوز branch-level از roleهای همان branch یا business ارث می‌رسد؛ branch role به business-wide scope ارتقا پیدا نمی‌کند.
- تا زمان ایجاد business و branch در onboarding، route عملیاتی scoped قابل استفاده نیست. migration هنوز اجرا نشده و role assignment endpoint هنوز اضافه نشده است.
- هر route عملیاتی آینده باید زنجیره SessionMiddleware → PermissionMiddleware داشته باشد؛ برای commandهای تغییردهنده state، CsrfMiddleware و idempotency نیز لازم‌اند.


## 15. BE-01E2 — راه‌اندازی اولیه کسب‌وکار و مدیریت انتساب نقش

- endpoint تغییر رمز اولیه \`POST /api/v1/auth/change-password\` اضافه شد؛ رمز جدید حداقل ۱۲ و حداکثر ۱۲۸ بایت است، رمز فعلی بررسی می‌شود، session_version افزایش می‌یابد و همه نشست‌ها باطل می‌شوند. کاربر پس از تغییر رمز دوباره وارد می‌شود.
- endpoint \`POST /api/v1/setup/business\` فقط برای owner نصب و پس از تغییر رمز اولیه در دسترس است؛ ایجاد اولین business و شعبه اصلی در یک transaction انجام می‌شود.
- جدول singleton به نام \`app_business_setup_state\` در migration 003 با \`SELECT ... FOR UPDATE\` از اجرای هم‌زمان setup و ساخت چند business اولیه جلوگیری می‌کند.
- endpointهای \`GET /api/v1/access/roles\`، انتساب نقش business/branch و حذف انتساب نقش با SessionMiddleware، PermissionMiddleware، CSRF و SameOriginGuard محافظت می‌شوند.
- نقش owner قابل انتساب از API scoped نیست؛ نقش هدف فقط وقتی قابل واگذاری است که actor تمام permissionهای آن نقش را در همان scope داشته باشد. نقش دارای wildcard قابل واگذاری نیست.
- business-wide endpointها وجود X-Branch-ID را رد می‌کنند تا مجوز محدود یک شعبه برای مدیریت کل کسب‌وکار استفاده نشود.
- نقش‌های پایه فعلاً قابل مشاهده و انتساب‌اند؛ CRUD نقش سفارشی و ویرایش permission mapping در بسته بعدی توسعه داده می‌شود.


## 16. BE-01E3 — مدیریت کاربر، نقش سفارشی و شعبه

- endpointهای GET/POST برای فهرست و ایجاد کاربر در سطح business و branch اضافه شدند؛ user جدید با password تصادفی ۲۵۶ بیتی ساخته می‌شود، hash فقط در DB ذخیره می‌شود و must_change_password=1 است.
- رمز موقت فقط یک‌بار در پاسخ ایجاد کاربر نمایش داده می‌شود؛ نباید در log، analytics یا storage مرورگر ثبت شود و باید از مسیر امن به کاربر تحویل شود.
- فهرست کاربران فقط کاربران منتسب به business/branch انتخاب‌شده و owner نصب را برمی‌گرداند؛ شناسه داخلی دیتابیس expose نمی‌شود.
- endpointهای GET/POST شعبه برای مشاهده و ساخت شعبه جدید اضافه شدند؛ شعبه جدید به business فعال متصل است و timezone پیش‌فرض را از business می‌گیرد.
- endpoint GET permissions فهرست permission codeهای فعال را می‌دهد؛ POST roles نقش سفارشی می‌سازد و PATCH roles/{roleCode} فقط نقش سفارشی را تغییر می‌دهد.
- نقش‌های system و owner از ویرایش محافظت می‌شوند؛ wildcard در نقش سفارشی مجاز نیست؛ actor فقط permissionهایی را می‌تواند به role بدهد که خودش در همان scope دارد.
- مدیریت نقش و user با PermissionMiddleware، scope و CSRF/same-origin در mutationها محافظت شده‌اند.
- فعلاً غیرفعال‌سازی کاربر/شعبه، حذف role، تاریخچه تغییر نقش و audit eventها در بسته Audit/Administration تکمیل می‌شوند.



## 14. وضعیت پیاده‌سازی واقعی Backend تا BE-01F1
- برخلاف وضعیت اولیه بخش‌های بالا، bootstrap HTTP، PDO/transaction، authentication/session/CSRF، login throttling، RBAC و business/branch scope اکنون در `v3/backend/src/` پیاده‌سازی شده‌اند؛ مسیرهای واقعی ثبت‌شده در `v3/backend/public/index.php` مرجع اجرا هستند.
- Migrationهای افزایشی 001 تا 003 برای session، login throttling و business/RBAC ثبت شده‌اند؛ migrationها هنوز روی دیتابیس مشتری اجرا نشده‌اند.
- BE-01F1 زیرساخت idempotency تراکنشی را اضافه می‌کند: کلید خام ذخیره نمی‌شود، fingerprint درخواست با SHA-256 نگهداری می‌شود، scope به actor/business/branch/endpoint محدود است و پاسخ ذخیره‌شده با AES-256-GCM و کلید مشتق‌شده از `POS_V3_APP_KEY` رمز می‌شود.
- `IdempotencyService::execute()` callback دامنه را با همان PDO داخل یک transaction اجرا می‌کند و پاسخ رمز‌شده را در همان transaction نهایی می‌کند؛ برای اتصال هر command، تمام writeهای دامنه باید از connection ارسالی callback استفاده کنند.
- استفاده مجدد از کلید با fingerprint متفاوت 409 می‌دهد؛ درخواست تکراری با fingerprint یکسان پاسخ موفق قبلی را replay می‌کند؛ درخواست هم‌زمان با unique key و row lock serialize می‌شود. retention پیش‌فرض ۲۴ ساعت و قابل تنظیم بین ۶۰ ثانیه تا ۷ روز است.
- Migration جدید `004_create-idempotency-keys.sql` فقط تعریف شده و اجرا نشده است. هنوز هیچ endpoint عملیاتی به IdempotencyService متصل نیست؛ اتصال باید هم‌زمان با vertical slice همان عملیات انجام شود.
- پاسخ‌های idempotency شامل داده‌های محرمانه احتمالی نیز به‌صورت رمز‌شده ذخیره می‌شوند؛ کلید رمزگشایی از secret محیطی ساخته می‌شود و secret یا token خام در جدول قرار نمی‌گیرد.
- تست، lint، build و اجرای migration در این بسته عمداً انجام نشده‌اند؛ طبق دستور مالک، تست‌ها به مرحله نهایی پروژه موکول شده‌اند.


## 15. BE-01F2 — دامنه audit و مشاهده تاریخچه
- جدول audit با migration افزایشی 005 به business و branch متصل می‌شود؛ رابطه مرکب branch/business مانع ثبت رویداد شعبه‌ای زیر کسب‌وکار اشتباه است.
- تمام رویدادهای فعلی ایجاد کسب‌وکار/شعبه/کاربر و ایجاد/ویرایش/انتساب/حذف نقش، business_id و در صورت نیاز branch_id ساختاریافته می‌گیرند؛ ثبت audit در همان transaction عملیات باقی می‌ماند.
- مسیر `GET /api/v1/audit-logs` با permission مستقل `audit.read` محافظت می‌شود. scope کسب‌وکار اجباری است؛ در scope شعبه رویدادهای همان شعبه به‌علاوه رویدادهای سطح کسب‌وکار قابل مشاهده‌اند.
- pagination با `before_id` و `limit` (۱ تا ۱۰۰، پیش‌فرض ۵۰) و ترتیب نزولی شناسه انجام می‌شود. Query string در Request محدود و parse می‌شود.
- ساخت AuditLogController lazy است تا endpoint عمومی liveness یا login بدون نیاز غیرضروری به DB از مسیر ساخت controller audit عبور کند.
- migration 005 ثبت شده و هنوز اجرا نشده است. تست‌ها و CI طبق دستور مالک به پایان توسعه موکول شده‌اند.


## 16. BE-01G1 — اولین vertical slice کاتالوگ
- Migration `006_scope-catalog-and-customers.sql`، دسته‌ها، محصولات، تنوع‌ها، گروه/گزینه‌ها، ارتباط محصول-گروه گزینه و مشتری را به business متصل می‌کند؛ شناسه عمومی برای دسته‌ها افزوده می‌شود.
- FKهای مرکب تضمین می‌کنند محصول به دسته همان کسب‌وکار، تنوع به محصول همان کسب‌وکار و گزینه به گروه همان کسب‌وکار متصل باشد. SKU محصول در محدوده business یکتا است.
- APIهای فعلی: `GET/POST /api/v1/catalog/categories` و `GET/POST /api/v1/catalog/products`. خواندن با `catalog.read` و ایجاد با `catalog.manage` کنترل می‌شود؛ همه routeها نشست معتبر و commandها CSRF و Origin check دارند.
- ایجاد دسته/محصول از `IdempotencyService` استفاده می‌کند؛ ثبت داده، audit و پاسخ رمز‌شده در transaction واحد انجام می‌شوند. قیمت و tax rate integer و در سمت سرور validate می‌شوند.
- API فقط business-scoped است؛ کاتالوگ بین شعب یک کسب‌وکار مشترک می‌ماند. داده عملیاتی branch-level در ماژول سفارش/صندوق جدا scope می‌شود.
- این slice فعلاً فقط category/product پایه را می‌خواند و ایجاد می‌کند؛ ویرایش/آرشیو، variant، option group، تصویر و مدیریت رسپی در بسته‌های بعدی ساخته می‌شوند. Migration 006 اجرا نشده است.


## 17. BE-01F1 — Audit trail و Idempotency اتمیک

- migration 004 جدول app_idempotency_keys را با scope actor/business/branch، endpoint code، key hash، request hash، lease، expiry و پاسخ رمز‌شده تعریف می‌کند.
- IdempotencyService عملیات دامنه و ذخیره پاسخ را در یک transaction واحد اجرا می‌کند؛ پاسخ موفق با AES-256-GCM رمز می‌شود و در دیتابیس به‌صورت ciphertext/nonce/tag می‌ماند.
- کلید خام Idempotency-Key در دیتابیس ذخیره نمی‌شود؛ fingerprint درخواست SHA-256 و scope شامل actor، business و branch است.
- عملیات create در کاتالوگ، ساخت branch، ساخت user و مدیریت role از IdempotencyService استفاده می‌کنند؛ پاسخ تکراری بدون اجرای مجدد عملیات replay می‌شود.
- پاسخ‌های non-2xx در جدول idempotency تکمیل نمی‌شوند؛ exception باعث rollback transaction و باقی‌نماندن رکورد نیمه‌کاره می‌شود.
- migration 005 ستون business_id و branch_id و foreign keyهای audit را اضافه می‌کند؛ branch باید به همان business مربوط باشد.
- AuditLogService snapshotها را از نظر کلیدهای محرمانه بررسی و اندازه JSON را محدود می‌کند؛ AuditLogRepository فقط append و read دارد و مسیر update/delete ارائه نمی‌دهد.
- رخدادهای business، branch، user، role، login، logout و تغییر رمز ثبت می‌شوند؛ رخدادهای scoped با business_id/branch_id ذخیره می‌شوند.
- GET /api/v1/audit-logs صفحه‌بندی cursor-based دارد؛ business-wide یا branch-filtered بر اساس مجوز و scope پاسخ می‌دهد.
- Idempotency برای mutationها باید در service و داخل transaction دامنه استفاده شود؛ middleware جداگانه عمداً حذف شد تا claim و commit عملیات از هم جدا نشوند.
- پاک‌سازی زمان‌بندی‌شده رکوردهای منقضی idempotency و سیاست نگهداری audit در بسته عملیات/maintenance تکمیل می‌شود.



## 17. BE-01G2 — تنوع محصول و افزودنی‌ها
- Migration 007 برای variant، option group و option شناسه عمومی UUID می‌افزاید؛ scope کسب‌وکار از Migration 006 حفظ می‌شود.
- تنوع محصول دارای نام، SKU اختیاری و delta قیمت علامت‌دار است.
- گروه گزینه دارای نوع single/multiple، حداقل/حداکثر انتخاب و مقدار پیش‌فرض اجباری بودن است؛ هر option delta قیمت مستقل دارد.
- گروه گزینه در سطح business ساخته و سپس به محصول متصل می‌شود؛ reuse گروه در چند محصول همان کسب‌وکار ممکن است.
- جزئیات محصول تنوع‌ها و گروه‌های متصل را با گزینه‌ها برمی‌گرداند. commandها idempotent، audit شده و تحت CSRF/Origin/RBAC هستند.
- Migration 007 اجرا نشده و تست‌ها به پایان توسعه موکول‌اند.


## BE-01G3 — مدیریت چرخه عمر محصولات و دسته‌بندی‌ها
- ویرایش دسته‌بندی با `PATCH /api/v1/catalog/categories/{categoryPublicId}`؛ فیلدهای قابل تغییر `name`، `parent_id`، `sort_order` و `is_active` هستند. دسته‌بندی فقط غیرفعال می‌شود و حذف فیزیکی ندارد.
- ویرایش محصول با `PATCH /api/v1/catalog/products/{productPublicId}`؛ فیلدهای `name`، `sku`، `product_type`، `base_price_amount`، `tax_rate_bps`، `category_id` و `is_active` با اعتبارسنجی سمت سرور کنترل می‌شوند.
- آرشیو محصول با `DELETE /api/v1/catalog/products/{productPublicId}` به‌صورت soft archive انجام می‌شود: `archived_at` ثبت و `is_active=0` می‌شود؛ ردیف برای حفظ ارجاعات سفارش‌های تاریخی نگه داشته می‌شود.
- همه commandها به business scope، permission `catalog.manage`، session، CSRF، Origin، Idempotency-Key و audit log مقیدند. هیچ mutation در دیتابیس اجرا نشده است.


## 18. BE-02A — هسته عملیاتی سفارش

- migration 008 جداول order، item، item option، status event، fulfillment، preparation، adjustment، dining area/table و table session را business/branch-scoped می‌کند.
- FKهای مرکب مانع اتصال سفارش به customer، product، variant، option، table session یا branch متعلق به business دیگر می‌شوند.
- order number از sequence مستقل برای هر business/branch ساخته می‌شود؛ order_number در محدوده شعبه یکتا است.
- POST /api/v1/orders سفارش را با قیمت authoritative دیتابیس می‌سازد؛ قیمت frontend دریافت یا اعتماد نمی‌شود.
- قیمت snapshot شامل base product، variant و option delta است؛ quantity با دقت سه رقم اعشار و محاسبه مبلغ با integer arithmetic انجام می‌شود.
- tax بر اساس tax_rate_bps محصول محاسبه می‌شود؛ subtotal قبل از مالیات، tax جدا و total برابر subtotal + tax است؛ discount و delivery fee فعلاً صفر هستند.
- گزینه‌ها با mapping محصول، بازه min/max، single/multiple و required اعتبارسنجی می‌شوند؛ variant فعال در صورت وجود اجباری است.
- ایجاد سفارش و ثبت وضعیت اولیه و audit در transaction واحد و با idempotency رمز‌شده انجام می‌شود.
- PATCH /api/v1/orders/{id}/status گردش وضعیت draft/awaiting_payment/accepted/preparing/ready/completed/cancelled/rejected را کنترل می‌کند؛ پرداخت از وضعیت سفارش مستقل است.
- PATCH /api/v1/orders/{id}/kitchen-status فقط preparing/ready را برای نقش kitchen مجاز می‌کند.
- GET /api/v1/orders فقط سفارش‌های همان branch را می‌دهد؛ فیلتر status/channel و limit حداکثر 100 دارد.
- فعلاً payment record، fulfillment detail، stock consumption/recipe, kitchen preparation item generation و pagination cursor در بسته‌های بعدی تکمیل می‌شوند.


### BE-02A تکمیلی — جزئیات سفارش و fulfillment
- GET /api/v1/orders/{orderPublicId} جزئیات سفارش، item snapshotها، گزینه‌ها، fulfillment، customer/table session و status history را فقط در scope همان branch برمی‌گرداند.
- fulfillment methodهای dine_in، takeaway و delivery پشتیبانی می‌شوند؛ channel=table به dine_in و channel=takeaway به takeaway نگاشت می‌شود.
- برای delivery، نام گیرنده، تلفن و address snapshot لازم است؛ delivery fee فعلاً صفر است و باید بعداً از تنظیمات/محاسبه سرور تعیین شود.
- address و recipient فقط در snapshot fulfillment ذخیره می‌شوند و در audit snapshot ثبت نمی‌شوند.

