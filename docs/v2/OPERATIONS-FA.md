# راهنمای عملیات و انتشار V2

## نیازمندی‌های هاست
- PHP 8.2+ (کد حداقل PHP 8.1)
- افزونه‌های PDO و pdo_mysql
- MySQL سازگار با JSON و InnoDB یا MariaDB سازگار
- Apache/LiteSpeed با پشتیبانی rewrite و فایل .htaccess
- HTTPS فعال

## ساخت بسته
در ریشه مخزن:
```bash
npm ci
npm run build:cpanel
```
بسته `dist-cpanel/` تولید می‌شود. در استقرار cPanel، Document Root باید روی `dist-cpanel/public` باشد و پوشه `private` بیرون Document Root بماند. راهنمای کامل backend در `php-backend/README-FA.md` است.

## تنظیمات محرمانه
- فایل واقعی `private/config.php` نباید وارد Git یا Document Root شود.
- مقادیر app_key و setup_token باید تصادفی و مستقل باشند.
- پس از ساخت مدیر اولیه، setup_token از config حذف شود.
- برای SMS، provider روی `national_payamak` و username/password/sender فقط در config خصوصی سرور تنظیم شوند.
- کلیدها، رمزها و توکن‌ها نباید در مرورگر، ZIP عمومی، log یا مستندات قرار گیرند.

## چک‌لیست پذیرش staging
- [ ] preflight و health با وضعیت سالم پاسخ دهند.
- [ ] ساخت مدیر اولیه و حذف setup token انجام شود.
- [ ] ورود/خروج و محدودیت نقش‌ها تأیید شود.
- [ ] ثبت سفارش و محاسبه قیمت سمت سرور تأیید شود.
- [ ] لغو سفارش و برگشت اثر موجودی/وفاداری بررسی شود.
- [ ] ارسال واقعی SMS و ثبت نتیجه در لاگ بررسی شود.
- [ ] backup گرفته و restore روی دیتابیس خالی آزمایش شود.
- [ ] قطع/وصل شبکه و جلوگیری از سفارش تکراری بررسی شود.
- [ ] رابط روی موبایل و دسکتاپ و چاپ فاکتور بررسی شود.

## ایمنی
هیچ تغییری روی هاست یا دیتابیس production در جریان مرتب‌سازی مخزن انجام نمی‌شود. انتشار production نیازمند نسخه پشتیبان قابل بازیابی، برنامه rollback و تأیید صریح مالک است.
