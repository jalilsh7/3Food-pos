<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Licensing;

/** Installation license state, entitlements and offline validity policy. */
interface LicensingApplication
{
    public function validateInstallation(string $installationId): array;

    public function getEntitlements(string $installationId): array;

    public function getOfflineValidity(string $installationId): array;
}
