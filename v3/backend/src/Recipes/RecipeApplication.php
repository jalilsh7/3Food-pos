<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Recipes;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for RecipeService. */
interface RecipeApplication
{
    public function getProductRecipe(BusinessContext $scope, string $productPublicId, ?string $variantPublicId): ?array;

    /**
         * @param array<string,mixed> $payload
         * @return array{status:int,body:array<string,mixed>,replayed:bool}
         */
    public function createDraftVersion(
            ActorContext $actor, BusinessContext $scope, string $productPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    /**
         * @param array<string,mixed> $payload
         * @return array{status:int,body:array<string,mixed>,replayed:bool}
         */
        public function createDraftVersion(
            ActorContext $actor, BusinessContext $scope, string $productPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array {
            if (!self::isUuid($productPublicId)) {
                throw new ApplicationException(422, 'product_id_invalid', 'The product identifier is invalid.');
            }
            $variantPublicId = $payload['variant_id'] ?? null;
            if ($variantPublicId !== null && (!is_string($variantPublicId) || !self::isUuid($variantPublicId))) {
                throw new ApplicationException(422, 'variant_id_invalid', 'The variant identifier is invalid.');
            }
            $name = trim((string) ($payload['name'] ?? ''));
            if ($name === '' || self::unicodeLength($name) > 160) {
                throw new ApplicationException(422, 'recipe_name_invalid', 'Recipe name is required and must not exceed 160 characters.');
            }
            $inputLines = $payload['lines'] ?? null;
            if (!is_array($inputLines) || count($inputLines) < 1 || count($inputLines) > 100) {
                throw new ApplicationException(422, 'recipe_lines_invalid', 'A recipe must contain between 1 and 100 ingredient lines.');
            }
    
            $normalizedLines = [];
            $seen = [];
            foreach ($inputLines as $line) {
                if (!is_array($line) || !is_string($line['stock_item_id'] ?? null)
                    || !self::isUuid($line['stock_item_id'])
                    || !is_string($line['unit_code'] ?? null)
                    || !preg_match('/^[a-z0-9._-]{1,32}$/', $line['unit_code'])) {
                    throw new ApplicationException(422, 'recipe_line_invalid', 'Each recipe line requires a stock item UUID and unit code.');
                }
                $quantity = self::decimalInput($line['quantity'] ?? null, 6, false, 'recipe_quantity_invalid');
                $waste = self::decimalInput($line['waste_percent'] ?? '0', 4, true, 'recipe_waste_invalid');
                if ((float) $waste > 100) {
                    throw new ApplicationException(422, 'recipe_waste_invalid', 'Waste percent must not exceed 100.');
                }
                $lineKey = $line['stock_item_id'] . ':' . $line['unit_code'];
                if (isset($seen[$lineKey])) {
                    throw new ApplicationException(422, 'recipe_line_duplicate', 'A stock item and unit combination can appear only once in a recipe version.');
                }
                $seen[$lineKey] = true;
                $normalizedLines[] = [
                    'stock_item_public_id' => $line['stock_item_id'],
                    'quantity' => $quantity,
                    'unit_code' => $line['unit_code'],
                    'waste_percent' => $waste,
                ];
            }
    
            $fingerprint = hash('sha256', json_encode(
                [$productPublicId, $variantPublicId, $name, $normalizedLines],
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
            ));
            return $this->idempotency->execute(
                $actor->userId, $scope, 'catalog.recipe.version.create', $key, $fingerprint,
                function () use (
                    $scope, $actor, $productPublicId, $variantPublicId, $name,
                    $normalizedLines, $requestId, $ip,
                ): array {
                    $productId = $this->recipes->findProductId($scope->businessId, $productPublicId);
                    if ($productId === null) {
                        throw new ApplicationException(404, 'product_not_found', 'The product was not found or is inactive.');
                    }
                    $variantId = $variantPublicId === null
                        ? null
                        : $this->recipes->findVariantId($scope->businessId, $productId, $variantPublicId);
                    if ($variantPublicId !== null && $variantId === null) {
                        throw new ApplicationException(404, 'variant_not_found', 'The active variant was not found for this product.');
                    }
    
                    $lines = [];
                    foreach ($normalizedLines as $line) {
                        $stockItem = $this->recipes->findStockItem($scope->businessId, $line['stock_item_public_id']);
                        if ($stockItem === null) {
                            throw new ApplicationException(404, 'recipe_stock_item_not_found', 'A stock item was not found or is inactive in this business.');
                        }
                        $unit = $this->recipes->findUnit($line['unit_code']);
                        if ($unit === null) {
                            throw new ApplicationException(422, 'recipe_unit_not_found', 'A recipe unit code does not exist.');
                        }
                        if ((string) $unit['dimension'] !== (string) $stockItem['base_unit_dimension']) {
                            throw new ApplicationException(422, 'recipe_unit_dimension_mismatch', 'Recipe units must match the stock item base unit dimension.');
                        }
                        $conversionFactor = (int) $unit['id'] === (int) $stockItem['base_unit_id']
                            ? '1.00000000'
                            : $this->recipes->findConversionFactor((int) $unit['id'], (int) $stockItem['base_unit_id']);
                        if ($conversionFactor === null || (float) $conversionFactor <= 0) {
                            throw new ApplicationException(422, 'recipe_unit_conversion_missing', 'No valid conversion exists from the recipe unit to the stock item base unit.');
                        }
                        $lines[] = [
                            'stock_item_id' => (int) $stockItem['id'],
                            'stock_item_public_id' => $line['stock_item_public_id'],
                            'quantity' => $line['quantity'], 'unit_id' => (int) $unit['id'],
                            'unit_code' => $line['unit_code'], 'conversion_factor' => $conversionFactor,
                            'waste_percent' => $line['waste_percent'],
                        ];
                    }
    
                    $recipe = $this->recipes->findRecipeForUpdate($scope->businessId, $productId, $variantId);
                    $before = $recipe === null ? null : [
                        'name' => (string) $recipe['name'], 'is_active' => (bool) $recipe['is_active'],
                    ];
                    if ($recipe === null) {
                        $recipePublicId = self::uuidV4();
                        $recipeId = $this->recipes->createRecipe(
                            $scope->businessId, $recipePublicId, $productId, $variantId, $name,
                        );
                    } else {
                        $recipeId = (int) $recipe['id'];
                        $recipePublicId = (string) $recipe['public_id'];
                        if ((string) $recipe['name'] !== $name) {
                            $this->recipes->updateRecipeName($scope->businessId, $recipeId, $name);
                        }
                    }
                    $versionPublicId = self::uuidV4();
                    $versionNo = $this->recipes->nextVersionNumber($scope->businessId, $recipeId);
                    $versionId = $this->recipes->createVersion(
                        $scope->businessId, $versionPublicId, $recipeId, $versionNo, $actor->userId,
                    );
                    foreach ($lines as $line) {
                        $this->recipes->createRecipeLine(
                            $scope->businessId, $versionId, $line['stock_item_id'], $line['quantity'],
                            $line['unit_id'], $line['conversion_factor'], $line['waste_percent'],
                        );
                    }
                    $after = [
                        'name' => $name, 'recipe_id' => $recipePublicId,
                        'version_id' => $versionPublicId, 'version_no' => $versionNo,
                        'status' => 'draft', 'line_count' => count($lines),
                    ];
                    $this->audit->record(
                        $actor->userId, 'catalog.recipe_version.created', 'recipe', $recipePublicId,
                        $before, $after, null, $requestId, $ip, $scope->businessId,
                    );
                    return ['status' => 201, 'body' => [
                        'data' => ['recipe' => [
                            'id' => $recipePublicId, 'name' => $name,
                            'version' => ['id' => $versionPublicId, 'version_no' => $versionNo, 'status' => 'draft'],
                        ]],
                        'meta' => (object) [],
                    ]];
                },
            );
        }
    
        /** @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function activateVersion(
            ActorContext $actor, BusinessContext $scope, string $versionPublicId,
            string $key, string $requestId, string $ip,
        ): array;
}
