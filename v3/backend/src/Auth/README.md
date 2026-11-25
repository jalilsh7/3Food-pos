# Auth / Access Module

## مسئولیت
هویت کاربر، ورود و خروج، session، business/branch scope، مدیریت نقش و مجوز و عملیات اولیه ایجاد کسب‌وکار.

## ورودی‌ها و قراردادها
- HTTP adapters: `AuthController`, `BusinessContextController`, `BusinessSetupController`, `BranchManagementController`, `RoleManagementController`, `UserManagementController`.
- Application services: `AuthenticationService`, `BusinessSetupService`, `BranchManagementService`, `RoleManagementService`, `UserManagementService`, `PermissionService`, `BusinessScopeResolver`.
- Persistence ports: `BusinessStore`, `UserStore`, `RoleStore`, `SessionStore`, `PermissionStore`.

## وابستگی‌های مجاز
سرویس‌های Auth به portهای ماژول، `TransactionBoundary`، `AuditLogService` و `LoginAttemptLimiter` وابسته‌اند. PDO و Repositoryهای concrete فقط در Composition Root/Infrastructure ساخته می‌شوند.

## Migrationها
003 business/RBAC، 001 session، 002 login-attempts، 005 audit scope.

## تست مستقل
مسیر هدف: `v3/backend/tests/Modules/Auth`. تست session lifecycle، permission scope، business isolation، setup idempotency و login throttling باید مستقل اجرا شوند. فعلاً تست ماژولی در tree وجود ندارد.

## عملیات و لاگ
خطاهای HTTP از Kernel عبور می‌کنند؛ رویدادهای امنیتی در AuditLog ثبت می‌شوند. داده‌های رمز، session token و cookie نباید در log ثبت شوند.

## Application API contracts
- `AuthenticationApplication`, `BusinessSetupApplication`, `BranchManagementApplication`, `RoleManagementApplication`, `UserManagementApplication`.
- HTTP controllers depend on these interfaces; concrete services are assembled in `public/index.php`.
