<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Media;

/** Storage port for private media objects. */
interface MediaStorage
{
    public function storeUploadedFile(string $temporaryPath, string $publicId, string $extension): string;

    public function read(string $storageKey): string;

    public function delete(string $storageKey): void;
}
