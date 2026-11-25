<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Public application contract for InventoryPostingService. */
interface InventoryPostingApplication
{
    public function post(
            ActorContext $actor, BusinessContext $scope, string $documentPublicId,
            string $key, string $requestId, string $ip,
        ): array;
}
