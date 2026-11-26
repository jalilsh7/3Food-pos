# HTTP Adapter Module

## مسئولیت
ورودی HTTP، routing، middleware dispatch، response envelope و تبدیل خطاهای کنترل‌نشده به پاسخ امن.

## ورودی‌ها و قراردادها
- `Request`, `Response`, `Router`, `Kernel`, `HttpException`.
- Controllerها در هر ماژول adapterهای HTTP هستند و Application Service را فراخوانی می‌کنند.

## وابستگی‌های مجاز
HTTP می‌تواند به Support Logger و application serviceها وابسته باشد؛ نباید PDO یا SQL اجرا کند. منطق دامنه نباید به Request/Response وابسته شود.

## Migrationها
ندارد.

## تست مستقل
مسیر هدف: `v3/backend/tests/Modules/Http`. تست routing, middleware order, CSRF/origin, request ID, error mapping و response headers لازم است. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
Kernel خطاهای کنترل‌نشده را با level/event/module/request_id ثبت می‌کند؛ message و payload حساس exception وارد log نمی‌شود.
