# Media Module

## مسئولیت
بارگذاری و نگهداری خصوصی تصاویر محصول و دسته‌بندی و اتصال asset به منابع Catalog.

## ورودی‌ها و قراردادها
- HTTP adapter: `MediaController`.
- Application service: `MediaService`.
- Persistence port: `MediaStore`.
- Storage port: `MediaStorage`; adapter: `Infrastructure/Storage/PrivateMediaStorage`.

## وابستگی‌های مجاز
سرویس فقط به MediaStore، MediaStorage، idempotency و audit وابسته است. فایل‌ها باید خارج از document root ذخیره شوند؛ کلید storage از public_id ساخته می‌شود و مسیر ورودی کاربر نباید پذیرفته شود.

## Migrationها
010 مالک Media است.

## تست مستقل
مسیر هدف: `v3/backend/tests/Modules/Media`. تست MIME/size validation، path traversal، symlink، permission، private read، delete و business scope لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
محتوای فایل و مسیر فیزیکی نباید در log ثبت شود؛ eventهای upload/delete با module=media ثبت شوند.
