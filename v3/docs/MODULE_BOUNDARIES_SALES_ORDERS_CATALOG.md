# قرارداد مرزی ماژول فروش، سفارش و کاتالوگ — V3

این سند جهت مهاجرت تدریجی و جلوگیری از coupling تعیین شده؛ به‌تنهایی ادعای refactor کد اجرایی ندارد.

## مرزها
- **POS / Sales orchestration:** سبد جاری، محاسبه snapshot قیمت، ثبت پرداخت/تسویه و orchestration use-case. مسئول persistence مستقیم نیست.
- **Orders:** lifecycle سفارش، کانال سفارش، fulfillment، state transitions، pagination/filtering و idempotency. منبع حقیقت سفارش.
- **Catalog/Menu:** دسته، محصول، SKU، variants، option groups، visibility و قیمت پایه؛ قیمت نهایی سفارش باید snapshot شود و از catalog زنده در زمان بعدی مشتق نشود.
- **Inventory:** stock ledger/document posting و availability؛ order workflow نباید repository انبار را مستقیم فراخوانی کند.
- **Recipes/Costing:** مصرف recipe و costing مستقل؛ برای posting از contract inventory استفاده کند، نه دستکاری stock.
- **Dining:** میز/سرویس سالن و وضعیت dining؛ به lifecycle سفارش از طریق قراردادهای مشخص متصل شود.

## قراردادهای وابستگی
1. UI فقط feature public entrypoint و shared API client/UI را مصرف کند؛ import از فایل داخلی feature دیگر ممنوع.
2. Controller: parse/validate HTTP input، استخراج principal/scope و mapping response؛ business rules در service/use-case.
3. Service/use-case: orchestration و قواعد کاربردی؛ repositoryها فقط در infrastructure.
4. Repository: persistence و queryها؛ فاقد HTTP/React و پیام‌های نمایشی.
5. ماژول‌ها با DTO/contractهای کوچک و پایدار ارتباط برقرار کنند؛ وابستگی مستقیم به repository ماژول دیگر ممنوع.
6. تغییر وضعیت order، payment و inventory posting باید atomicity/idempotency مناسب داشته باشند و audit context را منتقل کنند.
7. داده business/branch-scoped همیشه با scope معتبر محدود شود؛ scope را از payload کاربر اعتماد نکن.
8. Catalog data تغییرپذیر است؛ snapshot order items و قیمت‌ها باید هنگام ثبت سفارش محفوظ بماند.

## ترتیب refactor
- اول façadeهای سازگار و قراردادهای shared.
- انتقال validation و mapping بدون تغییر رفتار endpoint.
- سپس use-caseهای فروش/order و catalog به صورت دسته‌های کوچک.
- آخر حذف imports/adapterهای legacy و اجرای dependency checks.

## موارد بررسی نشده / نیاز به refactor اجرایی
- Controllerهای Catalog و Orders با روش‌های validation/mapping تکراری؛ استخراج HTTP helperها بدون حذف endpointها.
- Serviceها بزرگ هستند؛ تقسیم به use-caseهای read/write در دسته‌های بعد.
- Order/Catalog orchestration و repository boundaries در کد فعلی باید با بررسی کامل تک‌تک مسیرها مهاجرت کنند.
- این سند قرارداد معماری است؛ هنوز تست/بیلد یا اجرای refactor مربوطه را تایید نمی‌کند.
