<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Persistence port owned by the Auth/Access module. */
interface PermissionStore
{
    public function findActiveBusinessId(string $publicId): ?int;

    public function findActiveBranchId(string $publicId, int $businessId): ?int;

    /** @return list<string> */
    public function listUserPermissions(int $userId, int $businessId, ?int $branchId): array;

    public function userHasPermission(
            int $userId,
            string $permissionCode,
            int $businessId,
            ?int $branchId,
        ): bool;
}
