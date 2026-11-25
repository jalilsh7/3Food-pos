# Recipes Module

## مسئولیت
تعریف recipe، نسخه‌بندی recipe، مواد اولیه و مصرف انبار وابسته به فروش محصول/variant.

## ورودی‌ها و قراردادها
- HTTP adapter: `RecipeController`.
- Application service: `RecipeService`.
- Persistence port: `RecipeStore`; adapter: `Infrastructure/Database/RecipeRepository`.

## وابستگی‌های مجاز
RecipeStore و قراردادهای مشترک audit/idempotency مجازند. منطق costing نباید مستقیماً به SQL یا جداول Inventory خارج از قراردادهای آن وابسته شود.

## Migrationها
011 مالک مشترک Inventory/Recipes است؛ نسخه‌های بعدی recipe باید migration جدید با owner=Recipes داشته باشند.

## تست مستقل
مسیر هدف: `v3/backend/tests/Recipes`. تست نسخه فعال، تاریخچه نسخه، مواد معتبر، محاسبه مصرف و ارتباط variant لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
تغییر recipe باید audit شود؛ نسخه‌های مصرف‌شده نباید با update خام بازنویسی شوند.
