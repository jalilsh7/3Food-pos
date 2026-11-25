<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Media;

/** Public application contract for MediaService. */
interface MediaApplication
{
    public function upload(
            ActorContext $actor, BusinessContext $scope, array $file,
            string $key, string $requestId, string $ip,
        ): array;

    public function read(BusinessContext $scope, string $publicId): array;

    public function attachProductImage(
            ActorContext $actor, BusinessContext $scope, string $productPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    public function attachCategoryImage(
            ActorContext $actor, BusinessContext $scope, string $categoryPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    public function detachProductImage(
            ActorContext $actor, BusinessContext $scope, string $productPublicId,
            string $key, string $requestId, string $ip,
        ): array;

    public function detachCategoryImage(
            ActorContext $actor, BusinessContext $scope, string $categoryPublicId,
            string $key, string $requestId, string $ip,
        ): array;
}
