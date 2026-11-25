<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Persistence port owned by the Auth/Access module. */
interface BusinessStore
{
    public function isInstallationOwner(int $userId): bool;

    public function listAccessibleBusinesses(int $userId): array;

    public function assignBusinessOwner(int $userId, int $businessId): void;

    public function removeInstallationOwnerRole(int $userId): void;

    public function lockInitialBusinessId(): ?int;

    public function findBusinessTimezone(int $businessId): ?string;

    public function listBranches(int $businessId): array;

    public function createBusiness(
            string $publicId,
            string $code,
            string $name,
            string $timezone,
            string $currency,
        ): int;

    public function createBranch(
            string $publicId,
            int $businessId,
            string $code,
            string $name,
            ?string $timezone,
        ): int;

    public function markInitialBusinessCreated(int $businessId): void;
}
