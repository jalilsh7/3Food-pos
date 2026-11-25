# Central Admin Module

## مسئولیت
مدیریت مشتریان تجاری، پلن‌ها، محدودیت‌ها، لایسنس، وضعیت update و provisioning نصب‌ها.

## قراردادهای مورد انتظار
`TenantProvisioningApplication`, `PlanCatalog`, `LicenseIssuance`, `UpdateChannel`.

## وابستگی‌ها
Central Admin به دیتابیس عملیاتی فروش مشتریان دسترسی مستقیم ندارد؛ هر مشتری database مستقل دارد. کنترل feature و usage limit از طریق signed entitlement و کنترل server-side انجام می‌شود.

## Migration / Tests
Schema مرکزی مستقل از database مشتری است. تست هدف: `v3/backend/tests/Modules/CentralAdmin` برای tenant provisioning، plan changes، license issue/revoke و isolation.
