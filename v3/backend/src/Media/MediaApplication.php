<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Media;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for MediaService. */
interface MediaApplication
{
    /**
         * @param array{tmp_name:string,size:int,error:int} $file
         * @return array{status:int,body:array<string,mixed>,replayed:bool}
         */
    public function upload(
            ActorContext $actor, BusinessContext $scope, array $file,
            string $key, string $requestId, string $ip,
        ): array;

    /** @return array{metadata:array<string,mixed>,contents:string} */
    public function read(BusinessContext $scope, string $publicId): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function attachProductImage(
            ActorContext $actor, BusinessContext $scope, string $productPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function attachCategoryImage(
            ActorContext $actor, BusinessContext $scope, string $categoryPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function detachProductImage(
            ActorContext $actor, BusinessContext $scope, string $productPublicId,
            string $key, string $requestId, string $ip,
        ): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function detachCategoryImage(
            ActorContext $actor, BusinessContext $scope, string $categoryPublicId,
            string $key, string $requestId, string $ip,
        ): array;
}
