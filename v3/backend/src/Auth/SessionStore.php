<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Persistence port owned by the Auth/Access module. */
interface SessionStore
{
    public function create(
            int $userId,
            int $sessionVersion,
            string $tokenHash,
            string $csrfTokenHash,
            DateTimeImmutable $expiresAt,
            ?string $ipAddress = null,
            ?string $userAgentHash = null,
        ): int;

    public function findActiveByTokenHash(string $tokenHash): ?array;

    public function replaceCsrfTokenHash(int $sessionId, string $csrfTokenHash): void;

    public function revokeByTokenHash(string $tokenHash): void;

    public function revokeAllForUser(int $userId): void;
}
