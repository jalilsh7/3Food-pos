<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Public application contract for UserManagementService. */
interface UserManagementApplication
{
    public function listBusinessUsers(BusinessScope $scope): array;

    public function listBranchUsers(BusinessScope $scope): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createBusinessUser(
            AuthenticatedPrincipal $actor,
            BusinessScope $scope,
            string $username,
            string $displayName,
            string $roleCode,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createBranchUser(
            AuthenticatedPrincipal $actor,
            BusinessScope $scope,
            string $username,
            string $displayName,
            string $roleCode,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;
}
