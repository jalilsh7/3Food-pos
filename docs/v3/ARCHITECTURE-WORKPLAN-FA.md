# برنامه اجرایی اصلاح معماری سراسری V3

## اصل اجرا
کار گروهی و دسته‌ای؛ تغییرات معماری و انتقال کد در دسته‌های مرتبط. تست/بیلد جامع در پایان پروژه، مگر نیاز فوری به بررسی خاص برای جلوگیری از خطر یا ابهام. تست‌های حذف‌شده/تعویق‌افتاده در backlog ثبت می‌شوند.

## دسته‌های اجرایی

- [x] دسته ۰: بررسی وضعیت شاخه و ثبت استاندارد معماری و نقشه ماژول‌ها.
- [x] دسته ۱ (پایه): قرارداد خطا و logging مشترک در frontend، بدون وابستگی ماژول‌های تجاری.
- [x] دسته ۲-الف: API client correlation context و logging؛ PHP echo header.
- [ ] دسته ۲-ب: استخراج transport/session/contracts به adapters مستقل.
- [ ] دسته ۳: استخراج سفارش، فروش و کاتالوگ از featureهای یکپارچه.
- [ ] دسته ۴: موجودی، رسپی/بهای تمام‌شده، تامین‌کنندگان و هزینه‌ها.
- [ ] دسته ۵: مشتریان، وفاداری، کمپین‌ها و پیام‌رسانی.
- [ ] دسته ۶: تنظیمات، کاربران، نقش‌ها، مجوزها و گزارش‌ها.
- [ ] دسته ۷: PHP API domain boundaries و repository/use-case تفکیک.
- [ ] دسته ۸: migration ownership، نسخه‌بندی schema، قابلیت‌های تجاری و audit.
- [ ] دسته ۹: فروشگاه آنلاین و integrationها (WooCommerce و adapterهای دیگر).
- [ ] دسته ۱۰: licensing، entitlements، central-admin و update-management.
- [ ] دسته ۱۱: کاهش coupling، حذف adapterهای موقت، مستندات/نقشه نهایی.
- [ ] دسته نهایی: اجرای تست‌ها، build، تست migration/upgrade، نصب و rollback.

## وضعیت پایه
شاخه توسعه: `feature/3food-pos-next-release-v2`. معماری موجود هنوز ترکیبی از `src/features/pos`، `src/lib/pos` و ماژول pilot پیامک است. مهاجرت به‌صورت incremental خواهد بود و از شکستن APIهای فعلی جلوگیری می‌شود. دسته ۱ قرارداد پایه logger/error و دسته ۲-الف correlation ID frontend/PHP ثبت شده؛ build/test اجرا نشده.

## فهرست تست نهایی (تعویق)
- TypeScript/typecheck، lint و build کامل frontend.
- تست مستقل و قراردادی ماژول‌ها و dependency-cycle audit.
- PHP lint و API integration tests.
- DB migration fresh-install، upgrade path و rollback.
- احراز هویت، RBAC، tenant/business isolation و audit.
- فروش و سفارش end-to-end، تغییر وضعیت، موجودی، رسپی، گزارش، SMS.
- online storefront، integrationها، licensing/plan/activation.
- بسته‌بندی cPanel و سناریوی استقرار/backup/restore.
