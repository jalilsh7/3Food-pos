<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Finance;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for CashRegisterService. */
interface CashRegisterApplication
{
    public function list(BusinessContext $scope): array;

    public function createRegister(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function openSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $registerPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function closeSession(
            ActorContext $actor,
            BusinessContext $scope,
            string $sessionPublicId,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

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
