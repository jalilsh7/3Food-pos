# Storefront Module

## مسئولیت
منوی عمومی، تصاویر، ساعات کاری، cart، pickup/delivery و guest checkout.

## قراردادهای مورد انتظار
`PublicStorefrontApplication`, `PublicMenuQuery`, `GuestOrderCommand`, `StorefrontBusinessResolver`.

## وابستگی‌ها
business/branch از slug/domain توسط server resolver استخراج می‌شود؛ browser مجاز به ارسال business_id/branch_id نیست. Guest actor واقعی و type-safe باشد؛ user داخلی جعلی یا bypass middleware ممنوع. قیمت، تخفیف، مالیات، هزینه ارسال، موجودی و ساعات کاری در backend محاسبه شوند.

## Migration / Tests
تغییرات schema با owner=Storefront و forward migration. تست هدف: `v3/backend/tests/Modules/Storefront` برای guest actor، public projection، price tampering، delivery/pickup و branch isolation.
