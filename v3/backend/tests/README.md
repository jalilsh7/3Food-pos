# Backend module architecture tests

این تست‌ها به PHPUnit یا دیتابیس نیاز ندارند؛ ساختار وابستگی و وجود قراردادها را بررسی می‌کنند.

پس از پایان تطبیق معماری اجرا شود:

```bash
php tests/run.php
```

هر ماژول فایل `Modules/<Module>/ArchitectureTest.php` مستقل دارد. تست‌های رفتار، migration، tenant isolation و integration در suiteهای بعدی همین ماژول‌ها اضافه می‌شوند. این runner در مرحله فعلی عمداً اجرا نشده است.
