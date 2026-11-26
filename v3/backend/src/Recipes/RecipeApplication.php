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

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function activateVersion(
            ActorContext $actor, BusinessContext $scope, string $versionPublicId,
            string $key, string $requestId, string $ip,
        ): array;
}
