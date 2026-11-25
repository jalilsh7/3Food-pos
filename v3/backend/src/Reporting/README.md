# Reporting Module

## مسئولیت
گزارش‌های فروش، مالی، انبار و عملیات با read modelهای scoped و read-only.

## قراردادهای مورد انتظار
`ReportingQuery`, `ReportResult`, `ReportingReadStore` با pagination و time range صریح.

## وابستگی‌ها
فقط query/read contracts و projectionها؛ نوشتن در جداول دامنه و تغییر وضعیت سفارش/صندوق ممنوع. business/branch scope در تمام queryها اجباری است.

## Migration / Tests
Read model migrationها مستقل و versioned باشند. تست هدف: `v3/backend/tests/Modules/Reporting` برای aggregate accuracy، scope isolation و performance boundaries.
