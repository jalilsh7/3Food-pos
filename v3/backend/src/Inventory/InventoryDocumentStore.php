<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Persistence port owned by the Inventory module. */
interface InventoryDocumentStore
{
    public function findLocationId(int $businessId, int $branchId, string $publicId): ?int;

    public function findSupplierId(int $businessId, string $publicId): ?int;

    public function supplierIsActive(int $businessId, int $supplierId): bool;

    public function nextDocumentNumber(int $businessId, int $branchId): string;

    public function create(
            int $businessId, int $branchId, string $publicId, string $documentNo,
            string $type, int $locationId, ?int $destinationId, ?int $supplierId,
            ?string $reason, int $actorUserId,
        ): void;

    public function list(int $businessId, int $branchId, ?string $type, ?string $status, int $limit): array;

    public function find(int $businessId, int $branchId, string $publicId): ?array;

    public function findId(int $businessId, int $branchId, string $publicId): ?int;

    public function listValuationLines(int $businessId, int $branchId, int $documentId): array;

    public function findDraftForUpdate(int $businessId, int $branchId, string $publicId): ?array;

    public function listLinesForPostingForUpdate(int $businessId, int $branchId, int $documentId): array;

    public function updateLineValuation(
            int $businessId, int $branchId, int $documentId, int $lineId,
            string $unitCostSnapshot, string $totalCostAmount,
        ): void;

    public function markPosted(int $businessId, int $branchId, int $documentId): void;

    public function findStockItemForLine(int $businessId, string $publicId): ?array;

    public function findUnitForLine(string $unitCode): ?array;

    public function findConversionFactor(int $fromUnitId, int $toUnitId): ?string;

    public function addLine(
            int $businessId, int $branchId, int $documentId, string $linePublicId, int $stockItemId,
            string $quantity, int $unitId, string $conversionFactor, string $totalCostAmount, ?string $note,
        ): void;

    public function findLineForUpdate(
            int $businessId, int $branchId, int $documentId, string $linePublicId,
        ): ?array;

    public function updateLine(
            int $businessId, int $branchId, int $documentId, int $lineId, int $stockItemId,
            string $quantity, int $unitId, string $conversionFactor, string $totalCostAmount, ?string $note,
        ): void;

    public function deleteLine(int $businessId, int $branchId, int $documentId, int $lineId): void;
}
