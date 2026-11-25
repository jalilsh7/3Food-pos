<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Orders;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for OrderService. */
interface OrderApplication
{
    public function list(
            BusinessContext $scope,
            ?string $status,
            ?string $channel,
            int $limit,
            ?string $beforeCursor = null,
            ?string $paymentStatus = null,
            ?string $fulfillmentMethod = null,
            ?string $fromDate = null,
            ?string $toDate = null,
        ): array;

    public function get(BusinessContext $scope, string $orderPublicId): array;

    public function create(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function transition(
            ActorContext $actor,
            BusinessContext $scope,
            string $orderPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
            bool $kitchenOnly = false,
        ): array;

    public function transitionKitchen(
            ActorContext $actor,
            BusinessContext $scope,
            string $orderPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;
}
