# Frontend App Composition

## مسئولیت
نقطه ترکیب featureها، route/view selection و shell کلی برنامه. این لایه featureهای مستقل را کنار هم قرار می‌دهد.

## وابستگی مجاز
App می‌تواند feature entrypointها را import کند؛ featureها نباید App یا feature دیگری را import کنند. قراردادهای مشترک فقط از `shared/api` و `shared/ui` مصرف می‌شوند.

## تست مستقل
مسیر هدف: `v3/frontend/tests/app`. تست navigation، permission-based visibility و shell composition لازم است؛ فعلاً تست مستقل در tree وجود ندارد.
