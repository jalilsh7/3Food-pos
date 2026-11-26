# قرارداد مرزی موجودی، رسپی، تامین و هزینه — V3

## ماژول‌ها و مسئولیت
- Inventory: stock ledger، موجودی به تفکیک business/branch، اسناد ورود/خروج/اصلاح، posting و reversal.
- Inventory Documents: workflow سند و خطوط؛ قبل از posting قابل اصلاح، بعد از posting تغییرات با سند اصلاح/برگشت.
- Recipes: ساختار BOM، مقادیر و واحدها، mapping به مواد موجودی و نسخه‌بندی recipe برای جلوگیری از تغییر تاریخی.
- Costing: برآورد/محاسبه هزینه و snapshotهای هزینه؛ مستقل از ثبت سند موجودی.
- Suppliers: تامین‌کننده و اطلاعات تجاری، بدون مالکیت stock ledger.
- Expenses: هزینه‌های عملیاتی، جدا از خرید مواد و stock valuation مگر یک قرارداد accounting روشن تعریف شود.

## قواعد مرزی
1. هر تغییر stock فقط از مسیر posting service انجام شود؛ repository mutation از featureهای UI یا سایر domainها ممنوع.
2. posting باید در تراکنش و با idempotency، کنترل scope و audit context باشد.
3. اسناد posted حذف یا ویرایش مستقیم نمی‌شوند؛ reversal/correction سند جدید ایجاد می‌کند.
4. units و تبدیل واحدها باید در مرز مصرف/تولید معتبرسازی شود و تبدیل مبهم پذیرفته نشود.
5. recipe دارای version/ effective date یا snapshot در سفارش/مصرف باشد تا تغییر recipe تاریخچه را تغییر ندهد.
6. تامین‌کننده مالک اطلاعات تامین است؛ stock receipt/posting از قرارداد inventory پیروی می‌کند.
7. costing با inventory data همکاری می‌کند ولی مجاز به تغییر مستقیم stock balance نیست.
8. inventory و recipe/ supplier queries همواره با business/branch scope محدود می‌شوند.

## refactor بعدی
- استخراج use-caseهای inventory document و posting از serviceهای بزرگ.
- جداسازی recipe read/write و version/snapshot contract.
- مشخص کردن supplier purchase workflow مستقل؛ purchase receipt به posting contract متصل شود.
- expenses مستقل از supplier invoice و stock receipt باقی بماند مگر مدل حسابداری نهایی تعریف شود.

## وضعیت
این سند معماری و ترتیب refactor را تعریف می‌کند؛ اجرای کامل این refactor یا تست‌ها در این مرحله تایید نشده است.
