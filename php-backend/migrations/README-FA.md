# راهنمای migrationهای PHP/MySQL در 3Food POS V2

این پوشه فقط migrationهای backend نسخه V2 را نگه می‌دارد. migrationهای مسیر `database/v3/migrations/` متعلق به محصول V3 هستند و نباید روی دیتابیس V2 اجرا شوند.

## قاعده اجرا

- نصب تازه: فقط `schema.sql` را یک‌بار روی دیتابیس خالی وارد کنید؛ schema تازه شامل ساختار نهایی migrationها است و اجرای مجدد migrationهای زیر لازم نیست.
- دیتابیس قدیمی V2: ابتدا نسخه schema و migrationهای قبلاً اجراشده را بررسی کنید؛ فقط migrationهای مفقود را به ترتیب شماره و هر کدام یک‌بار اجرا کنید.
- روی دیتابیس عملیاتی دارای داده، `schema.sql` را دوباره import نکنید.
- قبل از هر migration از دیتابیس backup کامل بگیرید و ابتدا روی کپی staging بررسی کنید.
- این فایل migrationها را خودکار اجرا نمی‌کند و جایگزین جدول ثبت نسخه migration در دیتابیس نیست.

## ترتیب migrationهای موجود

| فایل | تغییر |
|---|---|
| `002-session-version.sql` | افزودن نسخه نشست برای ابطال نشست‌های قبلی |
| `003-order-idempotency.sql` | افزودن کلید یکتای جلوگیری از ثبت تکراری سفارش |
| `004-order-effects-ledger.sql` | دفتر اثرات موجودی و وفاداری سفارش برای برگشت کنترل‌شده |
| `005-order-discount-code.sql` | ذخیره کد تخفیف روی سفارش و index گزارش |
| `006-discount-redemptions-ledger.sql` | دفتر ثبت/برگشت مصرف کد تخفیف |
| `007-order-payment-and-guest-details.sql` | روش پرداخت، مشخصات مشتری مهمان و امتیازهای سفارش |
| `008-global-appearance-settings.sql` | تنظیمات ظاهری سراسری |
| `009-payment-terminal-foundation.sql` | جداول agent محلی، کارتخوان و تراکنش‌ها |

## نکته‌های سازگاری

- migration شماره 002 به‌صورت شرطی ستون را اضافه می‌کند.
- migrationهای 003، 005 و 007 از `ALTER TABLE` استفاده می‌کنند و برای هر دیتابیس فقط یک‌بار قابل اجرا هستند.
- migrationهای 004، 006، 008 و 009 از `CREATE TABLE IF NOT EXISTS` استفاده می‌کنند.
- migration 004 به جدول‌های `pos_orders` و `app_users` نیاز دارد.
- migration 009 به جدول‌های پایه کاربران و سفارش‌ها نیاز دارد.
- ترتیب فایل‌ها را تغییر ندهید؛ migrationها را فقط برای همسان‌سازی دیتابیس‌های قدیمی به کار ببرید.

نسخه نهایی schema برای نصب تازه در `php-backend/schema.sql` قرار دارد.
