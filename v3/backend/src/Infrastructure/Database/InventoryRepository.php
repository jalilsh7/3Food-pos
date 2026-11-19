<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class InventoryRepository
{
    public function __construct(private PDO $connection) {}

    public function listUnits(): array
    {
        $s = $this->connection->query(
            'SELECT code, name, dimension, decimal_places FROM pos_units ORDER BY dimension, name, code'
        );
        return array_map(static fn (array $row): array => [
            'code' => (string) $row['code'],
            'name' => (string) $row['name'],
            'dimension' => (string) $row['dimension'],
            'decimal_places' => (int) $row['decimal_places'],
        ], $s->fetchAll(PDO::FETCH_ASSOC));
    }

    public function findUnit(string $code): ?array
    {
        $s = $this->connection->prepare(
            'SELECT id, code, name, dimension, decimal_places FROM pos_units WHERE code = :code LIMIT 1'
        );
        $s->execute(['code' => $code]);
        $row = $s->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function listStockItems(int $businessId, ?string $search, int $limit): array
    {
        $sql = 'SELECT si.public_id, si.code, si.name, si.is_active, si.negative_stock_policy,
                       u.code AS base_unit_code, u.name AS base_unit_name, u.dimension AS base_unit_dimension
                FROM pos_stock_items si
                INNER JOIN pos_units u ON u.id = si.base_unit_id
                WHERE si.business_id = :business_id';
        $params = ['business_id' => $businessId];
        if ($search !== null && $search !== '') {
            $sql .= ' AND (si.name LIKE :search_name OR si.code LIKE :search_code)';
            $params['search_name'] = '%' . $search . '%';
            $params['search_code'] = '%' . $search . '%';
        }
        $sql .= ' ORDER BY si.name, si.id LIMIT :limit';
        $s = $this->connection->prepare($sql);
        foreach ($params as $key => $value) {
            if ($key === 'business_id') continue;
            $s->bindValue(':' . $key, $value, PDO::PARAM_STR);
        }
        $s->bindValue(':business_id', $businessId, PDO::PARAM_INT);
        $s->bindValue(':limit', $limit, PDO::PARAM_INT);
        $s->execute();
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'code' => (string) $row['code'],
            'name' => (string) $row['name'],
            'base_unit' => [
                'code' => (string) $row['base_unit_code'],
                'name' => (string) $row['base_unit_name'],
                'dimension' => (string) $row['base_unit_dimension'],
            ],
            'negative_stock_policy' => (string) $row['negative_stock_policy'],
            'is_active' => (bool) $row['is_active'],
        ], $s->fetchAll(PDO::FETCH_ASSOC));
    }

    public function findStockItem(int $businessId, string $publicId): ?array
    {
        $s = $this->connection->prepare(
            'SELECT si.id, si.public_id, si.code, si.name, si.base_unit_id, si.is_active,
                    si.negative_stock_policy, u.code AS base_unit_code, u.name AS base_unit_name
             FROM pos_stock_items si
             INNER JOIN pos_units u ON u.id = si.base_unit_id
             WHERE si.business_id = :business_id AND si.public_id = :public_id LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'public_id' => $publicId]);
        $row = $s->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function stockItemCodeExists(int $businessId, string $code, int $exceptId = 0): bool
    {
        $s = $this->connection->prepare(
            'SELECT 1 FROM pos_stock_items
             WHERE business_id = :business_id AND code = :code AND id <> :except_id LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'code' => $code, 'except_id' => $exceptId]);
        return $s->fetchColumn() !== false;
    }

    public function createStockItem(int $businessId, string $publicId, string $code, string $name, int $baseUnitId): int
    {
        $s = $this->connection->prepare(
            "INSERT INTO pos_stock_items (business_id, public_id, code, name, base_unit_id, is_active, negative_stock_policy)
             VALUES (:business_id, :public_id, :code, :name, :base_unit_id, 1, 'block')"
        );
        $s->execute([
            'business_id' => $businessId, 'public_id' => $publicId, 'code' => $code,
            'name' => $name, 'base_unit_id' => $baseUnitId,
        ]);
        return (int) $this->connection->lastInsertId();
    }

    public function updateStockItem(int $businessId, int $id, string $code, string $name, bool $active): void
    {
        $s = $this->connection->prepare(
            'UPDATE pos_stock_items SET code = :code, name = :name, is_active = :is_active
             WHERE business_id = :business_id AND id = :id'
        );
        $s->execute([
            'code' => $code, 'name' => $name, 'is_active' => $active ? 1 : 0,
            'business_id' => $businessId, 'id' => $id,
        ]);
    }

    public function stockItemHasActiveRecipe(int $businessId, int $stockItemId): bool
    {
        $s = $this->connection->prepare(
            "SELECT 1
             FROM pos_recipe_lines rl
             INNER JOIN pos_recipe_versions rv ON rv.id = rl.recipe_version_id AND rv.business_id = rl.business_id
             INNER JOIN pos_recipes r ON r.id = rv.recipe_id AND r.business_id = rv.business_id
             WHERE rl.business_id = :business_id AND rl.stock_item_id = :stock_item_id
               AND rv.status = 'active' AND r.is_active = 1 LIMIT 1"
        );
        $s->execute(['business_id' => $businessId, 'stock_item_id' => $stockItemId]);
        return $s->fetchColumn() !== false;
    }

    public function stockItemHasBalance(int $businessId, int $stockItemId): bool
    {
        $s = $this->connection->prepare(
            'SELECT 1 FROM pos_stock_balances
             WHERE business_id = :business_id AND stock_item_id = :stock_item_id
               AND (quantity_on_hand <> 0 OR quantity_reserved <> 0) LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'stock_item_id' => $stockItemId]);
        return $s->fetchColumn() !== false;
    }

    public function listLocations(int $businessId, int $branchId): array
    {
        $s = $this->connection->prepare(
            'SELECT public_id, code, name, location_type, is_active
             FROM pos_stock_locations
             WHERE business_id = :business_id AND branch_id = :branch_id
             ORDER BY name, id'
        );
        $s->execute(['business_id' => $businessId, 'branch_id' => $branchId]);
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'code' => (string) $row['code'],
            'name' => (string) $row['name'],
            'location_type' => (string) $row['location_type'],
            'is_active' => (bool) $row['is_active'],
        ], $s->fetchAll(PDO::FETCH_ASSOC));
    }

    public function findLocation(int $businessId, int $branchId, string $publicId): ?array
    {
        $s = $this->connection->prepare(
            'SELECT id, public_id, code, name, location_type, is_active
             FROM pos_stock_locations
             WHERE business_id = :business_id AND branch_id = :branch_id AND public_id = :public_id
             LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'branch_id' => $branchId, 'public_id' => $publicId]);
        $row = $s->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function locationCodeExists(int $businessId, int $branchId, string $code, int $exceptId = 0): bool
    {
        $s = $this->connection->prepare(
            'SELECT 1 FROM pos_stock_locations
             WHERE business_id = :business_id AND branch_id = :branch_id
               AND code = :code AND id <> :except_id LIMIT 1'
        );
        $s->execute([
            'business_id' => $businessId, 'branch_id' => $branchId,
            'code' => $code, 'except_id' => $exceptId,
        ]);
        return $s->fetchColumn() !== false;
    }

    public function createLocation(int $businessId, int $branchId, string $publicId, string $code, string $name, string $type): int
    {
        $s = $this->connection->prepare(
            'INSERT INTO pos_stock_locations (business_id, branch_id, public_id, code, name, location_type, is_active)
             VALUES (:business_id, :branch_id, :public_id, :code, :name, :type, 1)'
        );
        $s->execute([
            'business_id' => $businessId, 'branch_id' => $branchId, 'public_id' => $publicId,
            'code' => $code, 'name' => $name, 'type' => $type,
        ]);
        return (int) $this->connection->lastInsertId();
    }

    public function updateLocation(int $businessId, int $branchId, int $id, string $code, string $name, string $type, bool $active): void
    {
        $s = $this->connection->prepare(
            'UPDATE pos_stock_locations
             SET code = :code, name = :name, location_type = :type, is_active = :is_active
             WHERE business_id = :business_id AND branch_id = :branch_id AND id = :id'
        );
        $s->execute([
            'code' => $code, 'name' => $name, 'type' => $type, 'is_active' => $active ? 1 : 0,
            'business_id' => $businessId, 'branch_id' => $branchId, 'id' => $id,
        ]);
    }

    public function locationHasStock(int $businessId, int $branchId, int $locationId): bool
    {
        $s = $this->connection->prepare(
            'SELECT 1 FROM pos_stock_balances
             WHERE business_id = :business_id AND branch_id = :branch_id AND location_id = :location_id
               AND (quantity_on_hand <> 0 OR quantity_reserved <> 0) LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'branch_id' => $branchId, 'location_id' => $locationId]);
        return $s->fetchColumn() !== false;
    }
}
