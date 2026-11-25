# Updates Module

## مسئولیت
بسته‌بندی و انتشار کنترل‌شده نسخه‌ها، manifest امضاشده، compatibility، migration sequencing، backup و rollback/restore guidance.

## قراردادهای مورد انتظار
`UpdateManifest`, `UpdatePackageVerifier`, `UpdatePlanner`, `MigrationCompatibility`.

## وابستگی‌ها
Updater نباید migration منتشرشده را ویرایش کند؛ فقط migration forward اجرا می‌شود. update بدون backup/health gate و گزارش نتیجه ممنوع است.

## Migration / Tests
Metadata انتشار در CentralAdmin یا update registry مستقل است؛ migrationهای مشتری همچنان با runner محلی اجرا می‌شوند. تست هدف: `v3/backend/tests/Modules/Updates` برای signature، checksum، interrupted update، rollback/restore و compatibility.
