<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Persistence port owned by the Auth/Access module. */
interface UserStore
{
    public function findByUsername(string $username): ?array;

    public function findActiveById(int $userId): ?array;

    public function listBusinessUsers(int $businessId): array;

    public function listBranchUsers(int $businessId, int $branchId): array;

    public function usernameExists(string $username): bool;

    public function createUser(
            string $publicId,
            string $username,
            string $passwordHash,
            string $displayName,
        ): int;

    public function updatePasswordHash(int $userId, string $passwordHash): void;

    public function changePasswordAndRevokeSessions(int $userId, string $passwordHash): void;

    public function touchLastLogin(int $userId): void;
}
