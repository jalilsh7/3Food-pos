<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Catalog;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for CatalogService. */
interface CatalogApplication
{
    public function listCategories(BusinessContext $scope): array;

    public function listProducts(
            BusinessContext $scope,
            ?string $search,
            ?string $categoryPublicId,
            int $limit,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createCategory(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createProduct(
            ActorContext $actor,
            BusinessContext $scope,
            array $payload,
            string $idempotencyKey,
            string $requestId,
            string $ipAddress,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function updateCategory(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function updateProduct(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function archiveProduct(
            ActorContext $actor, BusinessContext $scope, string $publicId,
            string $key, string $requestId, string $ip,
        ): array;

    public function productDetails(BusinessContext $scope, string $publicId): array;

    public function createVariant(ActorContext $actor, BusinessContext $scope, string $productPublicId, array $payload, string $key, string $requestId, string $ip): array;

    public function createOptionGroup(ActorContext $actor, BusinessContext $scope, array $payload, string $key, string $requestId, string $ip): array;

    public function attachOptionGroup(ActorContext $actor, BusinessContext $scope, string $productPublicId, array $payload, string $key, string $requestId, string $ip): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function updateVariant(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function updateOptionGroup(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function updateOption(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;
}
