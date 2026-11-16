# تحلیل سورس واقعی احراز هویت و طرح اتصال PHP

تاریخ: 2026-11-17  
منبع بررسی: آرشیو `3food-pos-php-migration.zip` پس از تطبیق بایت‌به‌بایت با سورس اصلی

## نتیجه بررسی

آرشیو مهاجرت، تمام 107 فایل مشترک سورس اصلی را بدون تغییر دارد و 8 فایل PHP/MySQL به آن اضافه شده است. بنابراین می‌توان قراردادهای واقعی UI را بررسی کرد؛ با این حال شاخه GitHub هنوز این snapshot کامل را در خود ندارد.

## وضعیت فعلی احراز هویت در React

### سمت کلاینت

- `src/lib/auth/provider.tsx`: یک wrapper خالی است؛ جایگزینی آن به‌تنهایی احراز هویت را عوض نمی‌کند.
- `src/lib/auth/use-current-user.ts`: کاربر را از `authClient.useSession()` می‌خواند و در حالت auth خاموش، کاربر توسعه‌ای ثابت برمی‌گرداند.
- `src/lib/auth/client.ts`: Better Auth React client را می‌سازد؛ شامل OAuth، bearer token مخصوص preview، popup و منطق sign-out است.
- `src/lib/auth/gates.tsx`: اجزای SignedIn/SignedOut/SignInGate و UserButton به hook بالا متکی هستند.
- `src/routes/__root.tsx`: AuthProvider را دور Outlet قرار می‌دهد.
- `src/routes/index.tsx`: فقط صفحه اصلی POS را mount می‌کند؛ در routeهای فعلی، صفحه مستقل /login پیدا نشد. مقدار پیش‌فرض SIGN_IN_PATH در gates برابر /login است، پس مسیر ورود باید در طراحی جدید ایجاد شود.

### سمت سرور

- `src/lib/auth/middleware.ts` از `createMiddleware` در TanStack Start استفاده می‌کند.
- `src/lib/auth/verify.server.ts` نشست Better Auth را از request می‌خواند و شناسه کاربر را تأیید می‌کند.
- `src/lib/auth/server.ts` به Better Auth، PostgreSQL، PGLite و broker OAuth متکی است.
- `src/lib/auth/popup.server.ts` و بخش‌هایی از auth client برای ورود popup/OAuth هستند.
- `src/lib/app-data/readiness.ts` نیز از `createServerFn` استفاده می‌کند؛ حذف TanStack Start باید تمام این مرزهای server-function را پوشش دهد، نه فقط auth.

## شکاف‌های اصلی با نیاز نهایی

1. روش ورود فعلی OAuth است؛ نیاز نهایی ورود username/password برای همه نقش‌هاست.
2. کلاینت فعلی Better Auth است؛ باید فقط PHP session را منبع وضعیت ورود بداند.
3. server middleware فعلی وابسته به TanStack Start است و با معماری PHP API سازگار نیست.
4. route مستقل /login در سورس فعلی دیده نشد.
5. نقش‌های مدیر، صندوق‌دار و آشپزخانه باید از پاسخ معتبر PHP خوانده شوند؛ نوع AppUser فعلی role ندارد.
6. POS store در `src/lib/pos/store.ts` از Zustand persist استفاده می‌کند؛ داده‌های اصلی هنوز در مرورگر نگهداری می‌شوند و auth migration به‌تنهایی multi-device را حل نمی‌کند.

## طرح پیاده‌سازی امن

1. ابتدا snapshot کامل را در شاخه مهاجرت مستقر و صحت تمام فایل‌ها را با manifest SHA-256 ثبت کنیم.
2. قرارداد `phpApi.me/login/logout/changePassword` را با نوع‌های واقعی UI تطبیق دهیم.
3. یک AuthProvider واقعی بسازیم که در شروع برنامه `phpApi.me()` را اجرا کند و حالت pending/user/error را نگه دارد.
4. `useCurrentUserState` را به context جدید متصل کنیم؛ AppUser شامل id، نام نمایشی، username و role معتبر سرور باشد.
5. ورود username/password و خروج را در صفحه /login و UserButton به PHP API متصل کنیم؛ همه OAuth، popup و bearer preview حذف شوند.
6. guardهای UI فقط برای تجربه کاربری باشند؛ مجوز واقعی هر عملیات باید در PHP API بررسی شود.
7. middlewareهای TanStack Start را به APIهای PHP منتقل کنیم و تمام createServerFnهای وابسته به runtime قدیمی را حذف یا بازنویسی کنیم.
8. typecheck، تست واحد، build استاتیک و تست staging برای ورود، خروج، نشست منقضی، CSRF، نقش‌ها و دسترسی غیرمجاز اجرا شود.

## مواردی که فعلاً نباید انجام شوند

- جایگزینی فقط `provider.tsx` و ادعای تکمیل auth.
- استفاده از role یا user id ذخیره‌شده در localStorage به‌عنوان مجوز.
- باقی‌گذاشتن endpoint یا import پنهان Better Auth در build نهایی.
- انتشار قبل از آزمون PHP/MySQL واقعی و بررسی عملیات POS چنددستگاهی.

## وضعیت

این سند تحلیل سورس و طرح اجراست، نه ادعای پیاده‌سازی یا تست موفق. هنوز build و typecheck واقعی اجرا نشده‌اند.
