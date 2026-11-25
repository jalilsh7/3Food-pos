<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Public application contract for RoleManagementService. */
interface RoleManagementApplication
{
    public function listRoles(): array;

    public function listPermissions(): array;

    public function createCustomRole(
            AuthenticatedPrincipal $actor,
            BusinessScope $scope,
            string $code,
            string $name,
            array $permissionCodes,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function updateCustomRole(
            AuthenticatedPrincipal $actor,
            BusinessScope $scope,
            string $code,
            string $name,
            array $permissionCodes,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function assignBusinessRole(
            AuthenticatedPrincipal $actor,
            string $targetUserPublicId,
            string $roleCode,
            BusinessScope $scope,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function assignBranchRole(
            AuthenticatedPrincipal $actor,
            string $targetUserPublicId,
            string $roleCode,
            BusinessScope $scope,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function removeBusinessRole(
            AuthenticatedPrincipal $actor,
            string $targetUserPublicId,
            string $roleCode,
            BusinessScope $scope,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function removeBranchRole(
            AuthenticatedPrincipal $actor,
            string $targetUserPublicId,
            string $roleCode,
            BusinessScope $scope,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;
}
