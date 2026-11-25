<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Persistence port owned by the Inventory module. */
interface InventoryPostingStore
{
    public function lockBalance(
            int $businessId, int $branchId, int $stockItemId, int $locationId,
        ): array;

    public function stockItemForPosting(int $businessId, int $stockItemId): ?array;

    public function locationIsActive(int $businessId, int $branchId, int $locationId): bool;

    public function unitCostFromTotal(string $totalCostAmount, string $baseQuantity): string;

    public function costForQuantity(string $baseQuantity, string $unitCost): string;

    public function weightedAverageFromTotalCost(
            string $oldQuantity, string $oldAverageCost, string $incomingQuantity, string $incomingTotalCost,
        ): string;

    public function weightedAverageFromUnitCost(
            string $oldQuantity, string $oldAverageCost, string $incomingQuantity, string $incomingUnitCost,
        ): string;

    public function receiveBalance(
            int $businessId, int $branchId, int $stockItemId, int $locationId,
            string $baseQuantity, string $newAverageCost,
        ): void;

    public function issueBalance(
            int $businessId, int $branchId, int $stockItemId, int $locationId, string $baseQuantity,
        ): bool;

    public function appendLedger(
            int $businessId, int $branchId, int $stockItemId, int $locationId,
            int $documentLineId, string $movementType, string $quantityDelta,
            int $baseUnitId, string $unitCost, string $signedTotalCost, string $sourceEventKey,
        ): void;
}
