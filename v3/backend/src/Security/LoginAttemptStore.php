<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Persistence port for login throttling state. */
interface LoginAttemptStore
{
    public function isBlocked(string $accountHash, ?string $ipHash): bool;

    public function recordFailure(
        string $accountHash,
        ?string $ipHash,
        int $accountMaxAttempts,
        int $ipMaxAttempts,
    ): void;

    public function clear(string $accountHash): void;
}
