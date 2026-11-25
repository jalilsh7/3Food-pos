<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;


final readonly class PermissionService
{
    public function __construct(private PermissionStore $permissions) {}

    public function allows(
        AuthenticatedPrincipal $principal,
        string $permissionCode,
        BusinessScope $scope,
    ): bool {
        if (!preg_match('/^[a-z][a-z0-9_.-]{1,99}$/', $permissionCode)) {
            return false;
        }

        return $this->permissions->userHasPermission(
            $principal->userId,
            $permissionCode,
            $scope->businessId,
            $scope->branchId,
        );
    }
}
