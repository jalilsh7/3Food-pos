<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Persistence port owned by the Inventory module. */
interface InventoryStore
{
    public function listUnits(): array;

    public function findUnit(string $code): ?array;

    public function listStockItems(int $businessId, ?string $search, int $limit): array;

    public function findStockItem(int $businessId, string $publicId): ?array;

    public function stockItemCodeExists(int $businessId, string $code, int $exceptId = 0): bool;

    public function createStockItem(int $businessId, string $publicId, string $code, string $name, int $baseUnitId): int;

    public function updateStockItem(int $businessId, int $id, string $code, string $name, bool $active): void;

    public function stockItemHasActiveRecipe(int $businessId, int $stockItemId): bool;

    public function stockItemHasBalance(int $businessId, int $stockItemId): bool;

    public function listLocations(int $businessId, int $branchId): array;

    public function findLocation(int $businessId, int $branchId, string $publicId): ?array;

    public function locationCodeExists(int $businessId, int $branchId, string $code, int $exceptId = 0): bool;

    public function createLocation(int $businessId, int $branchId, string $publicId, string $code, string $name, string $type): int;

    public function updateLocation(int $businessId, int $branchId, int $id, string $code, string $name, string $type, bool $active): void;

    public function locationHasStock(int $businessId, int $branchId, int $locationId): bool;

    public function listBalances(
            int $businessId, int $branchId, ?int $stockItemId, ?int $locationId, int $limit,
        ): array;

    public function listLedger(
            int $businessId, int $branchId, ?int $stockItemId, ?int $locationId,
            ?int $beforeId, int $limit,
        ): array;
}
