<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Authorization query port shared by application modules. */
interface PermissionChecker
{
    public function allowsActor(
        int $actorUserId,
        string $permissionCode,
        int $businessId,
        ?int $branchId,
    ): bool;
}
