<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class CatalogRepository
{
    public function __construct(private PDO $connection) {}

    public function findCategoryIdByPublicId(int $businessId, string $publicId): ?int
    {
        $statement = $this->connection->prepare(
            'SELECT id FROM pos_categories WHERE business_id = :business_id AND public_id = :public_id AND is_active = 1 LIMIT 1'
        );
        $statement->execute(['business_id' => $businessId, 'public_id' => $publicId]);
        $value = $statement->fetchColumn();
        return $value === false ? null : (int) $value;
    }

    public function listCategories(int $businessId): array
    {
        $statement = $this->connection->prepare(
            'SELECT c.public_id, c.name, c.sort_order, c.is_active, p.public_id AS parent_public_id
             FROM pos_categories c
             LEFT JOIN pos_categories p ON p.id = c.parent_id AND p.business_id = c.business_id
             WHERE c.business_id = :business_id
             ORDER BY c.sort_order ASC, c.name ASC, c.id ASC'
        );
        $statement->execute(['business_id' => $businessId]);
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'parent_id' => $row['parent_public_id'] === null ? null : (string) $row['parent_public_id'],
            'sort_order' => (int) $row['sort_order'],
            'is_active' => (int) $row['is_active'] === 1,
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    public function createCategory(
        int $businessId,
        string $publicId,
        string $name,
        ?int $parentId,
        int $sortOrder,
    ): void {
        $statement = $this->connection->prepare(
            'INSERT INTO pos_categories (business_id, public_id, parent_id, name, sort_order, is_active)
             VALUES (:business_id, :public_id, :parent_id, :name, :sort_order, 1)'
        );
        $statement->execute([
            'business_id' => $businessId,
            'public_id' => $publicId,
            'parent_id' => $parentId,
            'name' => $name,
            'sort_order' => $sortOrder,
        ]);
    }

    public function listProducts(int $businessId, ?string $search, ?string $categoryPublicId, int $limit): array
    {
        $sql = 'SELECT p.public_id, p.name, p.sku, p.product_type, p.base_price_amount,
                       p.tax_rate_bps, p.is_active, c.public_id AS category_public_id,
                       c.name AS category_name
                FROM pos_products p
                LEFT JOIN pos_categories c ON c.id = p.category_id AND c.business_id = p.business_id
                WHERE p.business_id = :business_id AND p.archived_at IS NULL';
        $parameters = ['business_id' => $businessId];
        if ($search !== null && $search !== '') {
            $sql .= ' AND (p.name LIKE :search_name OR p.sku LIKE :search_sku)';
            $parameters['search_name'] = '%' . $search . '%';
            $parameters['search_sku'] = '%' . $search . '%';
        }
        if ($categoryPublicId !== null) {
            $sql .= ' AND c.public_id = :category_public_id';
            $parameters['category_public_id'] = $categoryPublicId;
        }
        $sql .= ' ORDER BY p.name ASC, p.id ASC LIMIT :limit';
        $statement = $this->connection->prepare($sql);
        foreach ($parameters as $key => $value) {
            if ($key === 'business_id') {
                continue;
            }
            $statement->bindValue(':' . $key, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':business_id', $businessId, PDO::PARAM_INT);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'sku' => $row['sku'] === null ? null : (string) $row['sku'],
            'product_type' => (string) $row['product_type'],
            'base_price_amount' => (int) $row['base_price_amount'],
            'tax_rate_bps' => (int) $row['tax_rate_bps'],
            'is_active' => (int) $row['is_active'] === 1,
            'category' => $row['category_public_id'] === null ? null : [
                'id' => (string) $row['category_public_id'],
                'name' => (string) $row['category_name'],
            ],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    public function findProductBySku(int $businessId, string $sku): bool
    {
        $statement = $this->connection->prepare(
            'SELECT 1 FROM pos_products WHERE business_id = :business_id AND sku = :sku LIMIT 1'
        );
        $statement->execute(['business_id' => $businessId, 'sku' => $sku]);
        return $statement->fetchColumn() !== false;
    }

    public function createProduct(
        int $businessId,
        string $publicId,
        ?int $categoryId,
        string $name,
        ?string $sku,
        string $productType,
        int $basePriceAmount,
        int $taxRateBps,
    ): void {
        $statement = $this->connection->prepare(
            'INSERT INTO pos_products
                (business_id, public_id, category_id, name, sku, product_type, base_price_amount, tax_rate_bps, is_active)
             VALUES
                (:business_id, :public_id, :category_id, :name, :sku, :product_type, :base_price_amount, :tax_rate_bps, 1)'
        );
        $statement->execute([
            'business_id' => $businessId,
            'public_id' => $publicId,
            'category_id' => $categoryId,
            'name' => $name,
            'sku' => $sku,
            'product_type' => $productType,
            'base_price_amount' => $basePriceAmount,
            'tax_rate_bps' => $taxRateBps,
        ]);
    }
}
