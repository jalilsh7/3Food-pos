<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Licensing;

/** Cryptographic verification port; key material is supplied by secure configuration. */
interface LicenseVerifier
{
    public function verify(string $licensePayload, string $signature, string $publicKey): bool;
}
