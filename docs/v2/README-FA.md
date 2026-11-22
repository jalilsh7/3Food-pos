# 3Food POS V2 — راهنمای ساختار پروژه

## محدوده
این پوشه و فایل‌های اجرایی ریشه مخزن، نسخه V2 را تشکیل می‌دهند. V2 یک POS مستقل برای استفاده فروشگاهی است:
- رابط: React 19، TypeScript، Vite و TanStack Router؛ خروجی SPA استاتیک.
- API: PHP در `php-backend/public/api` با مسیر هم‌مبدأ `/api/v1`.
- دیتابیس: MySQL/InnoDB.
- استقرار هدف: cPanel/LiteSpeed با PHP 8.2 و افزونه PDO MySQL.
- پیامک: اتصال اختیاری و سمت سرور؛ اطلاعات محرمانه فقط در `private/config.php`.

**V2 به V3 وابسته نیست.** کدهای V3 در `v3/`، دیتابیس V3 در `database/v3/` و اسناد آن در `v3/docs/` نگهداری می‌شوند. هیچ فایل V3 نباید به‌عنوان بخشی از بسته V2 وارد شود.

## نقشه فایل‌ها
| مسیر | کاربرد |
|---|---|
| `src/` | رابط کاربری V2 و کلاینت API |
| `php-backend/` | API، schema و migrationهای V2 |
| `scripts/` | تست‌ها، ممیزی build و بسته‌بندی V2 |
| `terminal-agent/` | عامل ویندوز برای زیرساخت کارتخوان؛ پشتیبانی واقعی هر مدل منوط به درایور و تست PSP است |
| `.github/workflows/php-migration-checks.yml` | کنترل‌های CI نسخه V2 |
| `docs/v2/` | اسناد جاری و تاریخچه V2 |
| `v3/`, `database/v3/` | پروژه مستقل V3؛ خارج از محدوده انتشار V2 |

## اجرای محلی
در ریشه مخزن:
```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build:cpanel
```
برای اجرای API و آزمون‌های MySQL، راهنمای `php-backend/README-FA.md` و workflow مربوط به PHP/MySQL را دنبال کنید.

## اصل مهم
موفقیت CI یا ساخت بسته، به‌تنهایی به معنی آماده‌بودن برای کار روزمره یا استقرار production نیست. معیارها و موانع انتشار در [وضعیت پروژه](./STATUS-FA.md) و [راهنمای عملیات](./OPERATIONS-FA.md) ثبت شده‌اند.
