<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Dining;

/** Persistence port owned by the Dining module. */
interface DiningStore
{
    public function listAreas(int $businessId, int $branchId): array;

    public function listTables(int $businessId, int $branchId): array;

    public function findAreaId(int $businessId, int $branchId, string $publicId): ?int;

    public function createArea(int $businessId, int $branchId, string $publicId, string $name, int $sortOrder): void;

    public function findTableForUpdate(int $businessId, int $branchId, string $publicId): ?array;

    public function createTable(
            int $businessId,
            int $branchId,
            int $areaId,
            string $publicId,
            string $code,
            int $capacity,
        ): void;

    public function createTableSession(
            int $businessId,
            int $branchId,
            int $tableId,
            string $publicId,
            int $openedBy,
        ): void;

    public function hasOpenSession(int $businessId, int $branchId, int $tableId): bool;

    public function findSessionForUpdate(int $businessId, int $branchId, string $publicId): ?array;

    public function hasUnfinishedOrdersForSession(int $businessId, int $branchId, int $sessionId): bool;

    public function closeTableSession(int $businessId, int $branchId, int $sessionId, int $closedBy): void;
}
