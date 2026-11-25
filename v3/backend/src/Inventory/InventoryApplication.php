<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Public application contract for InventoryService. */
interface InventoryApplication
{
    public function listUnits(): array;

    public function listStockItems(BusinessContext $scope, ?string $search, int $limit): array;

    public function createStockItem(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function updateStockItem(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function listLocations(BusinessContext $scope): array;

    public function createLocation(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function updateLocation(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function listBalances(
            BusinessContext $scope, ?string $stockItemPublicId, ?string $locationPublicId, int $limit,
        ): array;

    public function listLedger(
            BusinessContext $scope, ?string $stockItemPublicId, ?string $locationPublicId,
            ?int $beforeId, int $limit,
        ): array;
}
