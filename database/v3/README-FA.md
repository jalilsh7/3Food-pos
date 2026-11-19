# دیتابیس تجاری PersiaCoder POS V3

این پوشه متعلق به نسل تجاری V3 است و عمداً از schema و migrationهای runtime فعلی PHP جداست.

## هشدار نصب
- این baseline فقط برای یک دیتابیس تازه و خالی است.
- آن را روی دیتابیس POS فعلی، دیتابیس V2 یا دیتابیس حاوی جدول‌های عملیاتی اجرا نکنید.
- این commit فقط فایل‌ها را در مخزن ثبت می‌کند؛ هیچ دیتابیس واقعی را ایجاد یا تغییر نمی‌دهد.
- پیش از نصب مشتری، نسخه DB، backup قابل بازیابی، دسترسی محدود کاربر DB و محیط staging باید بررسی شود.

## نیازمندی‌ها
- MySQL 8.0.16+ یا MariaDB 10.6+
- InnoDB، utf8mb4 و PDO MySQL در PHP 8.2+
- timezone اتصال UTC؛ تبدیل تاریخ شمسی فقط در لایه نمایش.

## فایل‌ها
- schema.sql: baseline ساخت جداول نسخه اول؛ داده آزمایشی ندارد.
- migrations/: برای تغییرات بعد از انتشار baseline؛ در این بسته هنوز migration افزایشی منتشر نشده است.

## روش اجرای کنترل‌شده (فعلاً فقط راهنما)
1. یک دیتابیس کاملاً جدید و اختصاصی برای V3 بسازید.
2. از خالی بودن دیتابیس مقصد اطمینان بگیرید؛ وجود هر جدول عملیاتی باید باعث توقف نصب شود.
3. فایل schema.sql را روی MySQL/MariaDB هدف staging اجرا کنید.
4. خطای هر دستور باید نصب را متوقف کند؛ نصب نیمه‌کاره نباید به‌عنوان نصب موفق علامت‌گذاری شود.
5. پس از اجرای موفق و بررسی همه جداول/FKها، installer باید checksum فایل baseline را در app_schema_migrations ثبت کند.
6. نصب اولیه مدیر و seed نقش‌ها/مجوزهای ثابت باید از installer امن سمت سرور انجام شود؛ رمز یا حساب پیش‌فرض داخل SQL قرار نگیرد.
7. backup بگیرید و بازیابی آن را در دیتابیس خالی دیگری آزمایش کنید.

## قراردادهای مهم
- کلیدهای داخلی BIGINT UNSIGNED هستند؛ public_id برای منابع قابل ارجاع خارجی UUID v4 است.
- مبلغ‌ها integer تومان هستند. کد داخلی IRT در این baseline فقط marker سازگاری مدل فعلی برای تومان است و نباید به‌عنوان مقدار ریال ISO تعبیر شود؛ adapter پرداخت باید واحد PSP را تبدیل و اعتبارسنجی کند.
- مقدارهای انبار DECIMAL هستند و منفی‌شدن موجودی در نسخه اول مجاز نیست.
- event/ledgerها append-only طراحی شده‌اند؛ اصلاح با reversal/adjustment جدید انجام می‌شود.
- این فایل baseline اولیه است؛ migration runner، checksum verification، rollback/retry، CI روی MariaDB، backup/restore و race tests هنوز باید پیاده‌سازی و اجرا شوند.

## محدودیت‌های این بسته
این schema یک قرارداد اولیه اجرایی است اما هنوز به runtime PHP متصل نشده است. API، repository layer، installer، migration runner و UI در بسته‌های بعدی ساخته خواهند شد. اجرای مستقیم روی محیط اصلی ممنوع است.


## ابزار نصب و migration در V3

ابزارهای CLI مستقل از runtime فعلی V2 در مسیر database/v3/bin قرار دارند:

- install.php: فقط روی دیتابیس خالی اجرا می‌شود؛ وجود هر جدول یا view باعث توقف قبل از تغییر می‌شود.
- migrate.php: migrationهای افزایشی را به ترتیب نام فایل اجرا می‌کند؛ checksum هر نسخه در app_schema_migrations ثبت می‌شود.
- bootstrap.php: اتصال PDO، parser فایل SQL و قفل advisory مشترک.

نمونه تنظیم متغیرها (مقادیر واقعی را در shell امن خود وارد کنید و در مخزن commit نکنید):

- POS_V3_DB_HOST، POS_V3_DB_PORT، POS_V3_DB_NAME، POS_V3_DB_USER، POS_V3_DB_PASSWORD
- POS_V3_ADMIN_USERNAME، POS_V3_ADMIN_PASSWORD، POS_V3_ADMIN_NAME

رمز اولیه مدیر باید حداقل ۱۴ کاراکتر باشد؛ رمز به صورت hash ذخیره می‌شود و تغییر رمز در اولین ورود اجباری است. اجرای installer از HTTP مسدود است و فعلاً فقط CLI دارد.

دستورات از ریشه مخزن:
    php database/v3/bin/install.php
    php database/v3/bin/migrate.php

Baseline پس از نصب immutable است. تغییرات بعدی فقط با migration جدید انجام می‌شوند. قفل GET_LOCK اجرای هم‌زمان installer/migration را serialize می‌کند. از آنجا که DDL در MySQL/MariaDB اغلب implicit commit دارد، شکست وسط اجرای baseline یا migration می‌تواند دیتابیس نیمه‌ساخته باقی بگذارد؛ recovery باید روی دیتابیس disposable با ساخت مجدد دیتابیس انجام شود و هرگز نباید اسکریپت برای پاک‌سازی خودکار دیتابیس مشتری طراحی شود.

## وضعیت اعتبارسنجی

workflow جداگانه v3-database-validation.yml برای MySQL 8.4 و MariaDB 10.6 ایجاد شده است. این workflow نصب baseline، کنترل metadata و CHECK/FK/unique، نصب مدیر اولیه و اجرای دوباره migration runner را در دیتابیس‌های disposable آزمایش می‌کند.

در زمان ثبت این یادداشت، GitHub Actions jobها قبل از اجرای stepها fail شده‌اند و runner_id صفر بوده است؛ بنابراین نتیجه واقعی engine هنوز تأیید نشده است. تست محلی MySQL/MariaDB نیز در محیط توسعه در دسترس نبود.

## پشتیبان‌گیری و بازیابی CLI

- تهیه نسخه پشتیبان: php database/v3/bin/backup.php /secure/path/pos-v3-backup.jsonl.gz
- بازیابی فقط روی دیتابیس کاملاً خالی: php database/v3/bin/restore.php /secure/path/pos-v3-backup.jsonl.gz
- فرمت نسخه پشتیبان JSON Lines فشرده با gzip است؛ ساختار جدول‌ها و داده‌ها را ثبت می‌کند، ستون‌های generated را دوباره محاسبه می‌کند و هنگام بازیابی تعداد ردیف‌ها و روابط FK را بررسی می‌کند.
- فایل خروجی با مجوز 0600 ساخته می‌شود و مسیر داخل php-backend/public رد می‌شود. مسیر پشتیبان باید خارج از web root و ترجیحاً روی فضای جداگانه باشد.
- بازیابی فقط بین دو سرور از یک خانواده engine (MySQL به MySQL یا MariaDB به MariaDB) مجاز است. مقصد باید خالی باشد. شکست در میانه restore دیتابیس نیمه‌ساخته باقی می‌گذارد؛ مقصد disposable را حذف و از نو ایجاد کنید.
- archive به‌صورت پیش‌فرض رمزنگاری نمی‌شود و ممکن است داده مشتری/فروش داشته باشد؛ آن را خارج از سرور و بدون رمزنگاری ذخیره نکنید. رمزنگاری و انتقال امن باید در لایه storage/ops انجام شود.

## موارد باقی‌مانده فاز ۲

- اجرای موفق CI روی هر دو engine و رفع هر خطای واقعی schema/parser/installer/backup/restore.
- preflight سازگاری نسخه PHP/MySQL و مجوزهای دیتابیس.
- installer گرافیکی امن و اتصال آن به runtime V3؛ ابزار فعلی CLI است و هنوز به API/محصول متصل نشده است.
- پذیرش نهایی نصب تازه، نصب مجدد، شکست نیمه‌کاره و recovery.
