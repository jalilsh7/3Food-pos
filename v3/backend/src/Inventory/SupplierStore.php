<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Persistence port owned by the Inventory module. */
interface SupplierStore
{
    public function listForBusiness(int $businessId, bool $includeInactive = true): array;

    public function find(int $businessId, string $publicId): ?array;

    public function create(int $businessId, string $publicId, string $name, ?string $phone, ?string $notes): void;

    public function update(int $businessId, int $id, string $name, ?string $phone, ?string $notes, bool $active): void;
}
