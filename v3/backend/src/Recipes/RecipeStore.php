<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Recipes;

/** Persistence port owned by the Recipes module. */
interface RecipeStore
{
    public function findProductId(int $businessId, string $publicId): ?int;

    public function findVariantId(int $businessId, int $productId, string $publicId): ?int;

    public function findVariantIdForRead(int $businessId, int $productId, string $publicId): ?int;

    public function findStockItem(int $businessId, string $publicId): ?array;

    public function findUnit(string $code): ?array;

    public function findConversionFactor(int $fromUnitId, int $toUnitId): ?string;

    public function findRecipeForUpdate(int $businessId, int $productId, ?int $variantId): ?array;

    public function createRecipe(
            int $businessId, string $publicId, int $productId, ?int $variantId, string $name,
        ): int;

    public function updateRecipeName(int $businessId, int $recipeId, string $name): void;

    public function nextVersionNumber(int $businessId, int $recipeId): int;

    public function createVersion(
            int $businessId, string $publicId, int $recipeId, int $versionNo, int $actorUserId,
        ): int;

    public function createRecipeLine(
            int $businessId, int $versionId, int $stockItemId, string $quantity,
            int $unitId, string $conversionFactor, string $wastePercent,
        ): void;

    public function findVersion(int $businessId, string $publicId): ?array;

    public function findVersionForUpdate(int $businessId, string $publicId): ?array;

    public function retireActiveVersions(int $businessId, int $recipeId): void;

    public function activateVersion(int $businessId, int $versionId): bool;

    public function activateRecipe(int $businessId, int $recipeId): void;

    public function recipeDetails(int $businessId, int $productId, ?int $variantId): ?array;
}
