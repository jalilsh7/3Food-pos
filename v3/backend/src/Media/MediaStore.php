<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Media;

/** Persistence port owned by the Media module. */
interface MediaStore
{
    public function createAsset(
            int $businessId, string $publicId, string $storageKey, string $mimeType,
            int $byteSize, int $width, int $height, string $sha256, int $uploadedBy,
        ): int;

    public function findAsset(int $businessId, string $publicId): ?array;

    public function findProductId(int $businessId, string $publicId): ?int;

    public function findCategoryId(int $businessId, string $publicId): ?int;

    public function findProductImage(int $businessId, int $productId): ?array;

    public function findCategoryImage(int $businessId, int $categoryId): ?array;

    public function attachProductImage(int $businessId, int $productId, int $mediaId): void;

    public function attachCategoryImage(int $businessId, int $categoryId, int $mediaId): void;

    public function detachProductImage(int $businessId, int $productId): void;

    public function detachCategoryImage(int $businessId, int $categoryId): void;
}
