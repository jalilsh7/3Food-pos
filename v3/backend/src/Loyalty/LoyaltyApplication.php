<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Loyalty;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Ledger-based loyalty points and redemption use cases. */
interface LoyaltyApplication
{
    public function getBalance(ActorContext $actor, BusinessContext $scope, string $customerPublicId): array;

    public function earn(ActorContext $actor, BusinessContext $scope, string $customerPublicId, int $points, string $sourceCode, string $idempotencyKey, string $requestId): array;

    public function redeem(ActorContext $actor, BusinessContext $scope, string $customerPublicId, int $points, string $orderPublicId, string $idempotencyKey, string $requestId): array;

    public function expire(ActorContext $actor, BusinessContext $scope, string $customerPublicId, int $points, string $reason, string $idempotencyKey, string $requestId): array;
}
