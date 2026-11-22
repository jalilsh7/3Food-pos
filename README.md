# 3Food POS V2

مخزن شامل نسخه V2 صندوق فروشگاهی 3Food و فضای مستقل توسعه V3 است. **نسخه عملیاتی مورد بررسی این بخش، V2 است.**

## نسخه V2
- رابط React 19 + TypeScript + Vite به‌صورت SPA استاتیک
- بک‌اند PHP API در `php-backend/public/api`
- دیتابیس MySQL/InnoDB
- ورود با نام کاربری/رمز و نشست سمت سرور با کنترل نقش‌ها
- استقرار هدف cPanel/LiteSpeed با PHP 8.2 و MySQL
- پیامک اختیاری با تنظیمات خصوصی سمت سرور

راهنمای ساختار: [docs/v2/README-FA.md](docs/v2/README-FA.md)  
وضعیت و موانع استفاده روزمره: [docs/v2/STATUS-FA.md](docs/v2/STATUS-FA.md)  
راهنمای استقرار و آزمون: [docs/v2/OPERATIONS-FA.md](docs/v2/OPERATIONS-FA.md)  
قواعد ادامه توسعه: [docs/v2/AI-HANDOFF-FA.md](docs/v2/AI-HANDOFF-FA.md)

## ساخت و بررسی V2
```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build:cpanel
```

موفقیت CI یا build به‌تنهایی تأیید استفاده production نیست. staging واقعی، آزمون پیامک، backup/restore و پذیرش جریان فروشگاهی لازم است.

## تفکیک V3
V3 پروژه‌ای مستقل است و در `v3/`، `database/v3/` و `v3/docs/` نگهداری می‌شود. اسناد و کد V3 نباید وارد بسته استقرار V2 شوند.

## سیاست مخزن
- شاخه فعال V2: `feature/3food-pos-next-release-v2`
- `main` فعلی مبنای V2 نیست؛ در زمان این بازبینی فقط اسکلت کوچکی از V3 در آن دیده شد.
- تغییرات روی شاخه کاری و با PR انجام شوند؛ از reset، rebase مخرب و force-push خودداری شود.
- فایل‌های خصوصی، credentialها و config واقعی هرگز commit نشوند.
