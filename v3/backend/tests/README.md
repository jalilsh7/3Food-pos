# Backend module architecture tests

این تست‌ها به PHPUnit یا دیتابیس نیاز ندارند؛ ساختار وابستگی و وجود قراردادها را بررسی می‌کنند.

پس از پایان تطبیق معماری اجرا شود:

```bash
php tests/run.php
```

در حال حاضر 22 suite مستقل وجود دارد: 12 ماژول اجرایی با assertionهای مرزبندی و 10 ماژول تجاری آتی با کنترل وجود README/boundary. هر ماژول فایل `Modules/<Module>/ArchitectureTest.php` مستقل دارد. تست‌های رفتار، migration، tenant isolation و integration در suiteهای بعدی همین ماژول‌ها اضافه می‌شوند. این runner در مرحله فعلی عمداً اجرا نشده است.
