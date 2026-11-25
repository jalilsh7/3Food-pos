<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Recipes;

/** Public application contract for the Recipes module. */
interface RecipeApplication
{
    public function getProductRecipe(BusinessContext $scope, string $productPublicId, ?string $variantPublicId): ?array;

    public function createDraftVersion(
            ActorContext $actor, BusinessContext $scope, string $productPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    public function activateVersion(
            ActorContext $actor, BusinessContext $scope, string $versionPublicId,
            string $key, string $requestId, string $ip,
        ): array;
}
