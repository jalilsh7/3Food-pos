<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\POS;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** In-person cart and checkout orchestration; order lifecycle remains owned by Orders. */
interface PosSalesApplication
{
    /** @param list<array<string,mixed>> $items */
    public function buildCart(ActorContext $actor, BusinessContext $scope, array $items): array;

    /** @param array<string,mixed> $payload */
    public function checkout(ActorContext $actor, BusinessContext $scope, array $payload, string $idempotencyKey, string $requestId): array;
}
