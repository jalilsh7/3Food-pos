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

### مغایرت قطعی مشاهده‌شده
OrderService در سازنده PDO دریافت می‌کند و درون خود OrderRepository، IdempotencyService و AuditLogService را می‌سازد. این کار composition و orchestration را به service گره می‌زند و با قاعده جداسازی Application از Infrastructure و تزریق وابستگی‌ها در Composition Root منطبق نیست.
IdempotencyService نیز PDO دریافت کرده و Repository و TransactionManager را خودش می‌سازد؛ این مورد هم باید در refactor لایه‌ای اصلاح شود.
این مشاهده به‌تنهایی به معنی ایراد در رفتار فعلی سفارش نیست؛ موضوع، مرزبندی معماری و قابلیت تست مستقل است.

## 3) Database و Migration

مسیر مشاهده‌شده: database/v3

- README-FA.md
- bin/
- migrations/
- schema.sql

Migrationهای ترتیبی SQL مشاهده شدند؛ در فهرست اولیه حداقل migrationهای 001 تا 008 قابل مشاهده بود و در مستندات قبلی پروژه تا 011 نیز ثبت شده‌اند.

### ارزیابی
- نسخه‌بندی ترتیبی و وجود مسیر migration مثبت است.
- ساختار مشاهده‌شده یک پوشه مرکزی migrations است؛ استقلال مالکیت هر ماژول در ساختار مسیر/metadata هنوز اثبات نشده است.
- باید migration inventory تهیه شود: شماره، نام، مالک ماژول، جداول تحت مالکیت، پیش‌نیاز، destructive risk و مسیر upgrade.
- runner، checksum، ثبت migration اجراشده، اجرای مجدد و رفتار rollback/restore در مرحله تست نهایی بررسی می‌شوند؛ فعلاً تأییدشده تلقی نشوند.

## 4) Logging و Contracts

- وجود پایه logger/error و correlation ID در سوابق پیاده‌سازی پروژه ثبت شده است.
- فایل‌های دقیق logger در مسیرهای قبلاً فرض‌شده پیدا نشدند؛ ساختار واقعی باید با جست‌وجوی کامل tree و مسیرهای صحیح تثبیت شود.
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
4. تثبیت shared kernel و composition root؛ حذف ساخت مستقیم Repository/Infrastructure از use-case/serviceها.
5. اتصال و استانداردسازی logger و correlation context در frontend، PHP API، database و provider adapters.
6. تهیه migration ownership map و تعیین metadata/runner contract.
7. ایجاد الگوی docs/tests و ثبت پوشش مستقل تمام ماژول‌ها.
8. بررسی مرزهای tenant/business/branch، guest actor، central licensing و storefront در برابر مدل فعلی.
9. به‌روزرسانی وضعیت هر قانون به «استاندارد تثبیت‌شده»، «کد منطبق»، «نیازمند refactor» یا «تست معوق».
10. پس از بسته‌شدن همه موارد، اجرای یک‌باره تست جامع معماری و ثبت نتایج.

## 7) وضعیت فعلی

- استاندارد مرجع معماری: تثبیت شد.
- ساختار Feature-Based اولیه: وجود دارد؛ انطباق کامل تأیید نشده.
- جداسازی لایه‌ها: بخشی از ساختار وجود دارد؛ مغایرت اجرایی در composition سرویس سفارش مشاهده شد.
- قراردادهای ماژول: در اسناد تعریف شده؛ پوشش اجرایی ناقص/نامشخص.
- logging: پایه قبلی وجود دارد؛ اتصال سراسری نیازمند inventory است.
- migration: نسخه‌بندی ترتیبی وجود دارد؛ ownership مستقل نیازمند تعیین است.
- docs/tests: اسناد مرزبندی وجود دارد؛ مستندات و تست مستقل تمام ماژول‌ها تکمیل/تأیید نشده.
- تست نهایی: عمداً معوق تا پایان تطبیق کلی.
