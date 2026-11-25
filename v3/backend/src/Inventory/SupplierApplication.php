<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Public application contract for SupplierService. */
interface SupplierApplication
{
    public function list(BusinessContext $scope, bool $includeInactive = true): array;

    public function create(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function update(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;
}
