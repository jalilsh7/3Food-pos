<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Persistence port owned by the Auth/Access module. */
interface RoleStore
{
    public function listActiveRoles(): array;

    public function listActivePermissions(): array;

    public function findActiveRole(string $code): ?array;

    public function findActiveUserId(string $publicId): ?int;

    public function roleCodeExists(string $code): bool;

    public function isSystemRole(string $code): bool;

    public function findPermissionIdsByCodes(array $codes): array;

    public function createCustomRole(string $code, string $name): int;

    public function updateCustomRoleName(int $roleId, string $name): void;

    public function replaceRolePermissions(int $roleId, array $permissionIds): void;

    public function assignBusinessRole(int $userId, int $businessId, int $roleId, int $assignedBy): void;

    public function assignBranchRole(int $userId, int $branchId, int $roleId, int $assignedBy): void;

    public function removeBusinessRole(int $userId, int $businessId, int $roleId): bool;

    public function removeBranchRole(int $userId, int $branchId, int $roleId): bool;
}
