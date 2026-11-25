# مرزبندی تنظیمات، کاربران، نقش‌ها و گزارش‌ها — V3

## مسئولیت‌ها
- Configuration: تنظیمات business و branch، validate و persistence؛ تنظیمات حساس با secret handling.
- Identity & Access: identity، authentication، sessions، account lifecycle.
- Authorization: roles/permissions policy و permission evaluation؛ UI visibility فقط UX است و جای authorization سرور نیست.
- Audit: ثبت رویدادهای مهم، actor/context، تغییرات و request correlation، بدون secrets.
- Reporting: query/read model و گزارش‌های scoped؛ فاقد تغییر در domain data.
- Finance/Cash: ثبت cash movement، reconciliation و cash session lifecycle؛ order/payment status contractها را رعایت کند.

## قواعد
1. کنترل دسترسی روی backend هر عملیات؛ permissionهای فرانت‌اند به تنهایی امنیت نیست.
2. تنظیمات business/branch تفکیک و scope validation اعمال شود.
3. secrets نه در پاسخ read configuration، نه audit، نه log؛ نمایش masked و rotation.
4. گزارش‌ها از داده‌های scoped و read-only queryها استفاده کنند؛ exportها authorization و audit داشته باشند.
5. role/permission changes و settings changes audit شود؛ تغییرات حساس با re-authentication در صورت سیاست.
6. Session lifecycle، CSRF و same-origin controls از shared security layer استفاده کنند.
7. Reporting و UI به repositoryهای featureهای دیگر وابسته نشوند؛ read contract/query service استفاده کنند.

## refactor roadmap
- تنظیمات را به schema-backed config service منتقل کنید.
- permission catalog و policy evaluation را از controllerهای feature جدا کنید.
- report queries به read services/query handlers منتقل شود.
- audit schema و event policy را در سطح platform تثبیت کنید.

این سند معماری است و refactor اجرایی/تست کامل را ادعا نمی‌کند.
