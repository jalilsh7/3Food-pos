# Inventory Module

## مسئولیت
مواد اولیه و کالاهای انبار، انبار/مکان، تامین‌کننده، اسناد ورود/خروج/انتقال/ضایعات، ledger، balance و reservation.

## ورودی‌ها و قراردادها
- HTTP adapter: `InventoryController`.
- Application services: `InventoryService`, `InventoryDocumentService`, `InventoryPostingService`, `SupplierService`.
- Persistence ports: `InventoryStore`, `InventoryDocumentStore`, `InventoryPostingStore`, `SupplierStore`.

## وابستگی‌های مجاز
سرویس‌ها به portهای Inventory، idempotency و audit وابسته‌اند. موجودی منفی در baseline فعلی مجاز نیست؛ posting باید ledger و balance را اتمیک به‌روز کند. PDO/SQL فقط در Infrastructure است.

## Migrationها
011 مالک Inventory/Recipes و 012 مالک Inventory برای شناسه عمومی ردیف سند.

## تست مستقل
مسیر هدف: `v3/backend/tests/Inventory`. تست posting، reversal، reservation، transfer، stock balance، race condition و tenant/branch isolation لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
هر posting باید traceable و audit شود؛ خطاها با module=inventory و request_id ثبت شوند.
