<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Public application contract for BranchManagementService. */
interface BranchManagementApplication
{
    public function list(BusinessScope $scope): array;

    public function create(
            AuthenticatedPrincipal $actor,
            BusinessScope $scope,
            string $name,
            string $code,
            ?string $timezone,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;
}
