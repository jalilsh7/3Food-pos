# نقشه مالکیت Migrationهای V3

تاریخ استخراج: 2026-11-25  
مسیر فایل‌ها: `database/v3/migrations`

این نقشه از دستورهای `CREATE TABLE` و `ALTER TABLE` در SQLهای موجود استخراج شده است. «مالک» در این سند مالک دامنه‌ای جدول/تغییر است، نه ادعای وجود migration runner مستقل برای هر ماژول. تمام فایل‌های فعلی هنوز در پوشه مرکزی و با شماره ترتیبی اجرا می‌شوند.

## فهرست نسخه‌ها

| نسخه | فایل | مالک دامنه‌ای پیشنهادی | جداول/موجودیت‌های تحت پوشش | پیش‌نیاز مفهومی |
|---|---|---|---|---|
| 001 | `001_create-user-sessions.sql` | Auth / Identity | `app_user_sessions` | baseline و کاربران |
| 002 | `002_create-auth-login-attempts.sql` | Auth / Security | `app_auth_login_attempts` | baseline و تنظیم کلید برنامه |
| 003 | `003_create-business-scope-and-rbac.sql` | Tenancy / Access | `pos_businesses`, `app_business_setup_state`, `pos_branches`, `app_user_business_roles`, `app_user_branch_roles` | کاربران و نقش‌های baseline |
| 004 | `004_create-idempotency-keys.sql` | Shared Kernel / Security | `app_idempotency_keys` | کاربران، business scope |
| 005 | `005_add-audit-business-scope.sql` | Shared Kernel / Audit | `app_audit_logs`, ارتباط با `pos_branches` | business/branch scope |
| 006 | `006_scope-catalog-and-customers.sql` | Catalog + Customers | `pos_categories`, `pos_products`, `pos_product_variants`, `pos_option_groups`, `pos_options`, `pos_product_option_groups`, `pos_customers` | business scope |
| 007 | `007_catalog-variants-and-options.sql` | Catalog | `pos_product_variants`, `pos_option_groups`, `pos_options`, `pos_product_option_groups` | migration 006 |
| 008 | `008_scope-orders-and-service-areas.sql` | Orders + Dining | `pos_dining_areas`, `pos_dining_tables`, `pos_table_sessions`, `pos_preparation_stations`, `pos_orders`, `pos_order_items`, `pos_order_item_options`, `pos_order_status_events`, `pos_order_fulfillments`, `pos_order_item_preparations`, `pos_order_adjustments`, `pos_order_item_recipe_lines` | business/branch، catalog |
| 009 | `009_scope-payments-and-cash.sql` | Finance | `pos_payment_terminals`, `pos_terminal_transactions`, `pos_payments`, `pos_payment_events`, `pos_refunds`, `pos_registers`, `pos_cash_sessions`, `pos_expense_categories`, `pos_expenses`, `pos_cash_movements` | business/branch، orders |
| 010 | `010_private-media-assets.sql` | Media | `pos_media_assets`, `pos_product_media`, `pos_category_media` | business scope، catalog |
| 011 | `011_scope-inventory-and-recipes.sql` | Inventory + Recipes | `pos_stock_items`, `pos_stock_locations`, `pos_suppliers`, `pos_stock_documents`, `pos_stock_document_lines`, `pos_stock_ledger`, `pos_stock_balances`, `pos_stock_reservations`, `pos_stock_reservation_lines`, `pos_product_variants`, `pos_recipes`, `pos_recipe_versions`, `pos_order_items`, `pos_recipe_lines`, `pos_order_item_recipe_lines` | business/branch، catalog، orders |
| 012 | `012_stock-document-line-public-ids.sql` | Inventory | `pos_stock_document_lines` | migration 011 |

## قواعد مالکیت و تغییرات آینده

1. فایل‌های 001 تا 012 تغییرناپذیر تلقی می‌شوند؛ حتی اگر هنوز روی محیط عملیاتی اجرا نشده باشند، اصلاح مستقیم آن‌ها بدون بررسی baseline و محیط‌های هدف ممنوع است.
2. هر migration جدید باید یک مالک اصلی داشته باشد. اگر یک تغییر واقعاً بین چند دامنه مشترک است، مالک اصلی و دامنه‌های مصرف‌کننده در توضیح migration ثبت شوند.
3. migrationهای جدید باید با شماره سراسری یکتا در مسیر مرکزی فعلی ثبت شوند تا ترتیب runner حفظ شود؛ مالکیت دامنه‌ای با این نقشه و metadata ثبت می‌شود، نه با شکستن ناگهانی ترتیب اجرا.
4. تغییر schema متعلق به ماژول دیگر باید با قرارداد و هماهنگی مالک آن ماژول انجام شود؛ ماژول مصرف‌کننده نباید جداول ماژول دیگر را بدون قرارداد مالکیت تغییر دهد.
5. migrationهای destructive، backfillهای حجیم و تغییر FK/unique باید دارای یادداشت preflight، backup، recovery و اثر روی داده باشند.
6. تست migration مستقل هر ماژول باید روی baseline disposable و مسیر upgrade همان نسخه اجرا شود؛ اجرای آن در این مرحله عمداً به تست نهایی موکول است.

## وضعیت ابزار اجرا

- `database/v3/bin/migrate.php` فایل‌ها را از پوشه مرکزی می‌خواند، شماره‌ها را مرتب و تکراری‌ها را رد می‌کند، checksum نسخه اعمال‌شده را مقایسه می‌کند و برای اجرای هم‌زمان advisory lock می‌گیرد.
- metadata فعلی شامل version، checksum، applied_at و execution_ms است.
- `manifest.php` برای هر migration مالک، وابستگی، جدول‌های تحت پوشش و ریسک را ثبت می‌کند؛ runner وجود metadata، ترتیب dependency و برابری جدول‌های هدف SQL با manifest را پیش از اجرا validate می‌کند.
- تست معماری Backend نیز برابری SQL/manifest و کامل بودن registry را بدون اتصال دیتابیس بررسی می‌کند.
- MySQL/MariaDB برای بخشی از DDLها implicit commit دارند؛ rollback تراکنشی عمومی برای migrationها فرض نشود.
