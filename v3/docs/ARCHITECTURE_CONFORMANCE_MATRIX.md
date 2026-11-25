# ماتریس تطبیق معماری PersiaCoder POS V3

تاریخ: 2026-11-25  
شاخه: `feature/3food-pos-next-release-v2`

| قانون قطعی | شواهد اجرایی فعلی | وضعیت |
|---|---|---|
| 1. ماژولار و Feature-Based | Frontend feature folders مستقل؛ Backend module folders و README مستقل؛ import audit اولیه بدون cross-feature import در فایل‌های بررسی‌شده | جزئی، نیازمند rule خودکار و audit کامل backend |
| 2. جداسازی UI / Business / Infrastructure / Database | Application services ماژول‌های اصلی به Store ports متکی‌اند؛ PDO/Repository concrete در Infrastructure و Composition Root؛ Controllers به‌عنوان HTTP adapters | جزئی، چند adapter/خدمت Auth و shared services نیازمند بازبینی نهایی |
| 3. قرارداد ورودی/خروجی مشخص | Store interfaces، PermissionChecker، ActorContext، BusinessContext و ApplicationException ایجاد شده‌اند | جزئی، DTOهای typed و Result contracts برای همه use-caseها هنوز کامل نیست |
| 4. لاگ متمرکز و فیلتر بر اساس ماژول | Logger interface، JSON ErrorLogLogger، request_id، module، redaction و POS_V3_LOG_MODULES؛ Kernel و AuditLogService متصل‌اند | جزئی، provider events و همه use-caseها باقی است |
| 5. Migration مستقل و نسخه‌بندی‌شده | SQLهای 001–012 immutable؛ manifest مالکیت/ریسک/جداول/dependencies؛ runner checksum، sequence، lock و dependency validation | ساختار ثبت و اعتبارسنجی‌شده؛ تست upgrade/rollback و engine acceptance باقی است |
| 6. مستندات و تست مستقل هر ماژول | README مستقل Backend/Frontend و test suite معماری مستقل برای 12 ماژول Backend و Frontend feature boundaries ایجاد شده است | ساختار تست آماده؛ اجرا و تست‌های رفتاری/DB معوق |

## قراردادهای مشترک تازه

- `Support/ApplicationException`: خطای application؛ Kernel آن را به response تبدیل می‌کند. `HttpException` برای سازگاری controllerها subclass آن است.
- `Security/ActorContext` و `BusinessContext`: مدل context مشترک برای سرویس‌های ماژولی؛ controller از session و scope معتبر آن‌ها را می‌سازد.
- `Security/PermissionChecker`: port مجوز که Auth implementation آن را ارائه می‌کند.
- Persistence ports هر ماژول در namespace خود ماژول قرار دارند؛ implementationها در Infrastructure.

## شرط اعلام پایان

تطبیق معماری فقط وقتی تمام اعلام می‌شود که:
1. dependency audit کامل و automated architecture rules اجرا شود؛
2. تمام application services از HTTP/Auth/PDO concrete مستقل باشند؛
3. DTO/error/result contracts و module events تثبیت شوند؛
4. logger به use-caseها و provider adapters متصل باشد؛
5. migration manifest و upgrade path روی MySQL/MariaDB تست شوند؛
6. تست مستقل همه ماژول‌ها، tenant/branch isolation، build، lint و نصب/backup/restore با نتیجه واقعی ثبت شود.

**وضعیت فعلی: تطبیق معماری تمام نشده است.** هیچ تست جامع یا build در این مرحله اجرا نشده است.


## Test execution gate
- Backend architecture suites: ایجاد شده‌اند؛ اجرا نشده‌اند.
- Frontend architecture suite: ایجاد شده؛ اجرا نشده است.
- Integration/functional tests، tenant isolation، migration upgrade/rollback و build/lint: همگی برای انتهای تطبیق نگه داشته شده‌اند.


## Application API contracts
برای سرویس‌های Auth، Catalog، Orders، Dining، Finance، Inventory، Recipes و Media interface مستقل تعریف شده و Controllerها به قرارداد وابسته‌اند. DTOهای typed و Resultهای ساخت‌یافته هنوز برای تمام use-caseها کامل نیستند؛ بنابراین قانون سوم همچنان جزئی است.


## دامنه ماژول‌های آتی
README و test presence مستقل برای Customers، Loyalty، Messaging، Reporting، Storefront، Integrations، Licensing، CentralAdmin، Updates و POS اضافه شده است. این مورد فقط تثبیت مرز و مستندات است، نه تکمیل implementation. تست‌های رفتاری و contract آن‌ها همچنان معوق‌اند.
