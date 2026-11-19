# Migrationهای افزایشی V3

این پوشه فقط برای تغییرات پس از baseline منتشرشده V3 است.

## قرارداد نام‌گذاری
- نام فایل: NNN_description-with-hyphens.sql؛ شماره حداقل سه رقم و یکتا.
- فایل migration پس از انتشار/اعمال روی هر محیط immutable است.
- اصلاح migration اعمال‌شده ممنوع است؛ اصلاح بعدی باید migration جدید باشد.
- checksum SHA-256 هر فایل هنگام اجرا در app_schema_migrations ثبت می‌شود.
- تغییر checksum نسخه‌ای که قبلاً اعمال شده باشد باعث توقف runner می‌شود.
- اجرای هم‌زمان با قفل advisory دیتابیس serialize می‌شود.

## اجرا
متغیرهای محیطی POS_V3_DB_HOST، POS_V3_DB_PORT، POS_V3_DB_NAME، POS_V3_DB_USER و POS_V3_DB_PASSWORD را تنظیم کنید و از ریشه مخزن اجرا کنید:

    php database/v3/bin/migrate.php

Baseline با php database/v3/bin/install.php فقط روی دیتابیس خالی نصب می‌شود. فایل baseline بعد از نصب نباید تغییر کند؛ تمام تغییرات بعدی migration افزایشی هستند.

## محدودیت تراکنش
MySQL/MariaDB برای بسیاری از دستورات DDL implicit commit انجام می‌دهند. قفل runner از اجرای هم‌زمان جلوگیری می‌کند، اما شکست وسط یک migration لزوماً rollback کامل ندارد. هر migration باید کوچک، قابل بازبینی و دارای روش recovery مستند باشد؛ پس از شکست جزئی، runner را کورکورانه تکرار نکنید.


## Migration 001 — نشست‌های کاربری
- فایل `001_create-user-sessions.sql` جدول افزایشی `app_user_sessions` را ایجاد می‌کند.
- فقط hash شناسه نشست و hash توکن CSRF ذخیره می‌شوند؛ مقدار خام token در دیتابیس قرار نمی‌گیرد.
- نشست به کاربر FK دارد، session_version را snapshot می‌کند، expiry و revoke دارد و برای جست‌وجوی نشست فعال/پاکسازی انقضا index دارد.
- این migration فقط در repository ثبت شده و روی هیچ دیتابیسی اجرا نشده است.
- پس از انتشار، فایل immutable است؛ اصلاحات بعدی باید با migration جدید انجام شوند.


## Migration 002 — محدودسازی تلاش ورود
- فایل `002_create-auth-login-attempts.sql` جدول `app_auth_login_attempts` را برای شمارش تلاش‌های ناموفق و قفل موقت ایجاد می‌کند.
- دو bucket مستقل با HMAC از نام کاربری و IP نگهداری می‌شوند؛ کلید HMAC از متغیر محرمانه `POS_V3_APP_KEY` می‌آید و شناسه خام در جدول ذخیره نمی‌شود.
- سیاست فعلی: پنج تلاش ناموفق برای هر حساب یا ۳۰ تلاش از هر IP در پنجره ۱۵ دقیقه‌ای، سپس محدودسازی همان bucket برای ۱۵ دقیقه.
- این migration نیز فقط ثبت شده و هنوز اجرا نشده است.
