<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for SupplierService. */
interface SupplierApplication
{
    /** @return list<array<string,mixed>> */
    public function list(BusinessContext $scope, bool $includeInactive = true): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function create(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function update(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;
}
