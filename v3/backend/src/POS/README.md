# POS / Sales Module

## مسئولیت
گردآوری ورودی صندوق حضوری، cart و command فروش؛ مالک lifecycle سفارش یا ledger انبار/مالی نیست.

## قراردادهای مورد انتظار
`PosSalesApplication`, `CartCommand`, `CheckoutResult`; عملیات فروش از Orders application contract عبور می‌کند.

## وابستگی‌ها
POS فقط Catalog/Orders public application contracts را مصرف می‌کند؛ repository و service داخلی ماژول دیگر ممنوع. قیمت/مالیات/موجودی نهایی از backend می‌آید.

## Migration / Tests
در صورت نیاز به persistence اختصاصی، migration owner=POS؛ ترجیحاً cart موقت در client نگهداری شود. تست هدف: `v3/backend/tests/Modules/POS` برای cart invariants، idempotency و recovery.
