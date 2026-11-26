<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Storefront;

use PersiaCoder\PosV3\Security\BusinessContext;
use PersiaCoder\PosV3\Security\GuestActorContext;

/** Public menu projection and first-class guest checkout contract. */
interface PublicStorefrontApplication
{
    public function getMenu(string $storefrontKey, ?string $branchKey = null): array;

    public function getBusinessStatus(string $storefrontKey): array;

    /** @param array<string,mixed> $payload */
    public function submitGuestOrder(GuestActorContext $guest, BusinessContext $scope, array $payload, string $idempotencyKey, string $requestId): array;

    public function getOrderStatus(string $orderPublicId, string $accessToken): array;
}
