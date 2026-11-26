<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Application port for login throttling policy. */
interface LoginAttemptGuard
{
    public function assertAllowed(string $username, string $ipAddress): void;

    public function recordFailure(string $username, string $ipAddress): void;

    public function clearFailures(string $username, string $ipAddress): void;
}
