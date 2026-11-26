<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Integrations;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Use-case contract for external product/order synchronization. */
interface IntegrationsApplication
{
    /** @param array<string,mixed> $options */
    public function syncProducts(ActorContext $actor, BusinessContext $scope, string $providerCode, array $options, string $idempotencyKey, string $requestId): array;

    /** @param array<string,mixed> $options */
    public function syncOrders(ActorContext $actor, BusinessContext $scope, string $providerCode, array $options, string $idempotencyKey, string $requestId): array;

    public function setProductSource(ActorContext $actor, BusinessContext $scope, string $sourceCode, string $idempotencyKey, string $requestId): array;
}
