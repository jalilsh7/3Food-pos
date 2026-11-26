# Integrations Module

## مسئولیت
اتصال WooCommerce و providerهای بیرونی از طریق adapter، sync contract، cursor و idempotency.

## قراردادهای مورد انتظار
`IntegrationProvider`, `SyncCommand`, `SyncResult`, `ExternalIdMap`.

## وابستگی‌ها
Provider SDK فقط در Infrastructure adapter؛ ماژول دامنه به payload خام provider وابسته نشود. منبع حقیقت محصول/موجودی بین POS و WooCommerce باید برای هر tenant قابل انتخاب باشد.

## Migration / Tests
Mapping و sync state با migration مستقل owner=Integrations. تست هدف: `v3/backend/tests/Modules/Integrations` برای duplicate delivery، conflict، retry، cursor و source-of-truth rules.
