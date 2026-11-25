<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Catalog;

/** Public application contract for the Catalog module. */
interface CatalogApplication
{
    public function listCategories(BusinessContext $scope): array;

    public function listProducts(
            BusinessContext $scope,
            ?string $search,
            ?string $categoryPublicId,
            int $limit,
        ): array;

    public function createCategory(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function createProduct(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    public function updateCategory(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function updateProduct(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function archiveProduct(
            ActorContext $actor, BusinessContext $scope, string $publicId,
            string $key, string $requestId, string $ip,
        ): array;

    public function productDetails(BusinessContext $scope, string $publicId): array;

    public function createVariant(ActorContext $actor, BusinessContext $scope, string $productPublicId, array $payload, string $key, string $requestId, string $ip): array;

    public function createOptionGroup(ActorContext $actor, BusinessContext $scope, array $payload, string $key, string $requestId, string $ip): array;

    public function attachOptionGroup(ActorContext $actor, BusinessContext $scope, string $productPublicId, array $payload, string $key, string $requestId, string $ip): array;

    public function updateVariant(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function updateOptionGroup(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function updateOption(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;
}
