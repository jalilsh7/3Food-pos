# Messaging Module

## مسئولیت
SMS provider adapters، قالب‌های پیام، service template، event toggles، dispatch queue، campaign و consent/opt-out.

## قراردادهای مورد انتظار
`MessagingApplication`, `SmsProvider`, `TemplateRegistry`, `MessageDispatchStore`; provider response خام از ماژول خارج نشود.

## وابستگی‌ها
Orders/Customers فقط event یا contract می‌فرستند؛ Messaging به جداول داخلی آن‌ها دسترسی مستقیم ندارد. credentials در secrets/config نگهداری و در log redact می‌شوند.

## Migration / Tests
Migration مستقل با owner=Messaging. تست هدف: `v3/backend/tests/Modules/Messaging` برای template approval، retries، idempotency، provider errors، consent و event toggles.
