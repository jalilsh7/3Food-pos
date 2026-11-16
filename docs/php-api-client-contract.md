# قرارداد کلاینت مرورگر برای PHP API

این سند همراه `src/lib/api/php-client.ts` است.

## پایه و نشست

- تمام درخواست‌ها به مسیر هم‌مبدأ `/api/v1` ارسال می‌شوند.
- `credentials: same-origin` برای ارسال کوکی HttpOnly نشست فعال است.
- رمز عبور، شناسه نشست و CSRF نباید در localStorage یا Zustand persist ذخیره شوند.
- CSRF پس از login، setup اولیه و `GET /auth/me` فقط در حافظه ماژول نگهداری می‌شود.
- درخواست‌های تغییردهنده داده، هدر `X-CSRF-Token` می‌فرستند.
- توکن راه‌اندازی اولیه فقط در هدر `X-Setup-Token` ارسال می‌شود و نباید وارد URL یا log شود.

## APIهای پوشش‌داده‌شده در کلاینت

- سلامت سرویس: `GET /health`
- ساخت مدیر اولیه: `POST /setup/manager`
- ورود/بازیابی نشست/خروج: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- تغییر رمز: `POST /auth/change-password`
- bootstrap داده: `GET /bootstrap`
- رکوردها: `GET/POST/DELETE /records/{resource}`
- سفارش: `POST /orders`
- تغییر وضعیت: `PATCH /orders/{id}/status`

## محدودیت‌های مهم

این commit فقط لایه انتقال HTTP و مدیریت CSRF در حافظه را اضافه می‌کند. هنوز:
- AuthProvider و صفحه ورود به این کلاینت متصل نشده‌اند.
- Zustand store هنوز persist و داده محلی دارد.
- قرارداد سفارش هنوز از totals ارسالی کلاینت استفاده می‌کند؛ تا اصلاح محاسبه سمت سرور، ثبت سفارش برای بهره‌برداری واقعی تأیید نیست.
- bootstrap هنوز سقف ۵۰۰ سفارش دارد.
- هیچ تست build، typecheck یا اتصال MySQL با این commit ادعا نمی‌شود.

## ترتیب اتصال بعدی

1. اتصال وضعیت احراز هویت به `phpApi.me/login/logout` و حذف مسیر Better Auth از اپ عملیاتی.
2. افزودن guard برای صفحات و تغییر رفتار بر اساس نقش برگشتی از سرور.
3. جایگزینی عملیات داده در store با bootstrap و endpointهای PHP، با حالت loading/error و بدون از دست‌دادن داده.
4. پس از آن، اصلاح API سفارش و اجرای تست‌های خودکار/چنددستگاهی.
