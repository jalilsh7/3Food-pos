<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Dining;

/** Public application contract for the Dining module. */
interface DiningApplication
{
    public function list(BusinessContext $scope): array;

    public function createArea(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function createTable(
            ActorContext $actor,
            BusinessContext $scope,
            string $areaPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function openSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $tablePublicId,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function closeSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $sessionPublicId,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;
}
