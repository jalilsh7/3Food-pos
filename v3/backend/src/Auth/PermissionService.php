<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;


final readonly class PermissionService implements \PersiaCoder\PosV3\Security\PermissionChecker
{
    public function __construct(private PermissionStore $permissions) {}

    public function allows(
        AuthenticatedPrincipal $principal,
        string $permissionCode,
        BusinessScope $scope,
    ): bool {
        return $this->allowsActor($principal->userId, $permissionCode, $scope->businessId, $scope->branchId);
    }

    public function allowsActor(
        int $actorUserId,
        string $permissionCode,
        int $businessId,
        ?int $branchId,
    ): bool {
        if (!preg_match('/^[a-z][a-z0-9_.-]{1,99}$/', $permissionCode)) {
            return false;
        }

        return $this->permissions->userHasPermission(
            $actorUserId,
            $permissionCode,
            $businessId,
            $branchId,
        );
    }
}
