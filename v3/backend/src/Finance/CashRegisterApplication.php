<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Finance;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for CashRegisterService. */
interface CashRegisterApplication
{
    /** @return array<string,mixed> */
    public function list(BusinessContext $scope): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function createRegister(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function openSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $registerPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function closeSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $sessionPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function reviewSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $sessionPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;
}
