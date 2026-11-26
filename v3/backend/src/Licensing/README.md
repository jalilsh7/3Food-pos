# Licensing Module

## مسئولیت
فعال‌سازی و اعتبارسنجی لایسنس دائمی، دوره یک‌ساله update، اعتبار آفلاین قابل تنظیم، entitlement و محدودیت‌های پلن.

## قراردادهای مورد انتظار
`LicenseVerifier`, `LicenseState`, `FeatureEntitlement`, `OfflineValidityPolicy`.

## وابستگی‌ها
داده لایسنس و entitlement از CentralAdmin دریافت می‌شود؛ featureها فقط contract را مصرف می‌کنند. license secret یا signing key نباید در database عملیاتی مشتری ذخیره شود.

## Migration / Tests
Migration محلی حداقلی با owner=Licensing؛ تست هدف: `v3/backend/tests/Modules/Licensing` برای signature، offline grace، clock skew، tampering و entitlement enforcement.
