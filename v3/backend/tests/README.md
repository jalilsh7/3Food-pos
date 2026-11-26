# Backend module architecture tests

این تست‌ها به PHPUnit یا دیتابیس نیاز ندارند؛ ساختار وابستگی و وجود قراردادها را بررسی می‌کنند.

پس از پایان تطبیق معماری اجرا شود:

```bash
php tests/run.php
```

در حال حاضر 22 suite مستقل وجود دارد: 12 ماژول اجرایی با assertionهای مرزبندی/DI و 10 ماژول تجاری آتی با کنترل وجود Application contract و signature-only بودن. هر ماژول فایل `Modules/<Module>/ArchitectureTest.php` مستقل دارد. تست‌های رفتار، migration، tenant isolation و integration در suiteهای بعدی همین ماژول‌ها اضافه می‌شوند. این runner در مرحله فعلی عمداً اجرا نشده است.


## Dependency graph guard
`Architecture/DependencyGraphTest.php` به‌صورت static تمام PHP sourceها را اسکن می‌کند تا Application Service/Contractها به PDO، HTTP، Infrastructure یا ماژول‌های دیگر وابسته نشوند و Controllerها persistence مستقیم نداشته باشند. این guard هنوز اجرا نشده است.
