# Loyalty Module

## مسئولیت
امتیاز مشتری، earn/redeem ledger، expiry و قواعد وفاداری؛ موجودی امتیاز باید ledger-based و قابل ممیزی باشد.

## قراردادهای مورد انتظار
`LoyaltyApplication`, `LoyaltyStore`, earn/redeem command و balance projection.

## وابستگی‌ها
Orders فقط از طریق domain event یا application contract اطلاع‌رسانی می‌کند؛ Loyalty مالک سفارش یا payment نیست. Redemption باید در transaction هماهنگ با Orders/Finance انجام شود.

## Migration / Tests
Migration مستقل با owner=Loyalty در آینده؛ SQL migrationهای منتشرشده تغییر نکنند. تست هدف: `v3/backend/tests/Modules/Loyalty` برای replay، expiry، concurrency و ledger invariants.
