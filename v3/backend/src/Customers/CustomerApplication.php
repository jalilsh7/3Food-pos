<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Customers;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Customer profile, search and consent use cases. */
interface CustomerApplication
{
    /** @return list<array<string,mixed>> */
    public function search(ActorContext $actor, BusinessContext $scope, string $query, int $limit = 20): array;

    /** @return array<string,mixed> */
    public function get(ActorContext $actor, BusinessContext $scope, string $customerPublicId): array;

    /** @param array<string,mixed> $payload */
    public function create(ActorContext $actor, BusinessContext $scope, array $payload, string $idempotencyKey, string $requestId): array;

    /** @param array<string,mixed> $payload */
    public function update(ActorContext $actor, BusinessContext $scope, string $customerPublicId, array $payload, string $idempotencyKey, string $requestId): array;

    public function setConsent(ActorContext $actor, BusinessContext $scope, string $customerPublicId, string $channel, bool $consented, string $idempotencyKey, string $requestId): array;
}
