<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Dining;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for DiningService. */
interface DiningApplication
{
    /** @return array<string,mixed> */
    public function list(BusinessContext $scope): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function createArea(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function createTable(
            ActorContext $actor,
            BusinessContext $scope,
            string $areaPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function openSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $tablePublicId,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function closeSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $sessionPublicId,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;
}
