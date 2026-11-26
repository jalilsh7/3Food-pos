# مرزبندی مشتری، وفاداری و پیام‌رسانی — V3

## مرز ماژول‌ها
- Customers/CRM: پروفایل مشتری، اطلاعات تماس، تاریخچه و مدیریت رضایت/ترجیحات.
- Loyalty: قواعد امتیاز و مزایا، ledger امتیاز و redemption؛ داده‌های مشتری را از طریق contract دریافت می‌کند.
- Messaging: ارسال و مدیریت پیام؛ provider adapter مستقل و channel abstraction.
- Campaigns: segment/query criteria، preview، consent checks، rate limits، scheduling و نتیجه ارسال.
- SMS provider: credentialها فقط از secret/config امن، هیچ secret در logs، errorها یا UI diagnostics ثبت نشود.

## قواعد
1. opt-in/opt-out و سابقه رضایت به عنوان داده قابل audit ثبت شود؛ صرف تیک UI جای رضایت ذخیره‌شده را نمی‌گیرد.
2. campaign قبل از ارسال باید target preview، محدودیت‌های ارسال و consent filtering را اعمال کند.
3. event-triggered messages و campaign bulk از queue/dispatch abstraction مشترک اما policyهای جدا استفاده کنند.
4. provider failure، retry و delivery status بدون ارسال تکراری کنترل شوند؛ برای هر message یک idempotency/dispatch identity.
5. Loyalty balance با ledger تراکنش‌ها ساخته شود؛ اصلاح امتیاز با ثبت رویداد اصلاحی، نه دستکاری خام balance.
6. PII و phone number در logs redacted و دسترسی به exports محدود شود.
7. UI فقط public module contract را مصرف کند؛ provider implementation و persistence جزئیات داخلی هستند.

## Refactor roadmap
- تفکیک Customer service و loyalty ledger/use-cases.
- Campaign criteria و message dispatch service را جدا کنید.
- SMS providers را به adapters و credential lifecycle منتقل کنید.
- consent lifecycle، suppression list و delivery retry را یکپارچه کنید.

این سند قرارداد/نقشه است؛ refactor اجرایی و تست هنوز انجام نشده.
