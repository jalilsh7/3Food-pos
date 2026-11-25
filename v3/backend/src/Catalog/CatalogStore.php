<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Catalog;

/** Persistence port owned by the Catalog module. */
interface CatalogStore
{
    public function findCategoryIdByPublicId(int $businessId, string $publicId): ?int;

    public function listCategories(int $businessId): array;

    public function createCategory(
            int $businessId,
            string $publicId,
            string $name,
            ?int $parentId,
            int $sortOrder,
        ): void;

    public function listProducts(int $businessId, ?string $search, ?string $categoryPublicId, int $limit): array;

    public function findProductBySku(int $businessId, string $sku): bool;

    public function createProduct(
            int $businessId,
            string $publicId,
            ?int $categoryId,
            string $name,
            ?string $sku,
            string $productType,
            int $basePriceAmount,
            int $taxRateBps,
        ): void;

    public function findProductIdByPublicId(int $businessId, string $publicId): ?int;

    public function createVariant(int $businessId,int $productId,string $publicId,string $name,?string $sku,int $delta): void;

    public function createOptionGroup(int $businessId,string $publicId,string $name,string $type,int $min,int $max,bool $required,array $options): void;

    public function findOptionGroupId(int $businessId,string $publicId): ?int;

    public function attachOptionGroup(int $businessId,int $productId,int $groupId,int $sort,bool $required): void;

    public function productHasOptionGroup(int $businessId,int $productId,int $groupId): bool;

    public function productDetails(int $businessId,int $productId): ?array;

    public function findCategoryDetails(int $businessId, string $publicId): ?array;

    public function updateCategory(int $businessId, int $categoryId, string $name, ?int $parentId, int $sortOrder, bool $isActive): void;

    public function findProductDetails(int $businessId, string $publicId): ?array;

    public function findProductSkuConflict(string $sku, int $exceptProductId): bool;

    public function updateProduct(
            int $businessId, int $productId, ?int $categoryId, string $name, ?string $sku,
            string $productType, int $basePriceAmount, int $taxRateBps, bool $isActive,
        ): void;

    public function archiveProduct(int $businessId, int $productId): void;

    public function findVariantDetails(int $businessId, string $publicId): ?array;

    public function variantSkuExists(int $businessId, int $productId, string $sku, int $exceptVariantId): bool;

    public function updateVariant(
            int $businessId, int $variantId, string $name, ?string $sku, int $priceDelta, bool $isActive,
        ): void;

    public function findOptionGroupDetails(int $businessId, string $publicId): ?array;

    public function countActiveOptions(int $businessId, int $groupId): int;

    public function updateOptionGroup(
            int $businessId, int $groupId, string $name, string $selectionType,
            int $minSelect, int $maxSelect, bool $requiredDefault, bool $isActive,
        ): void;

    public function findOptionDetails(int $businessId, string $publicId): ?array;

    public function updateOption(
            int $businessId, int $optionId, string $name, int $priceDelta, bool $isActive,
        ): void;
}
