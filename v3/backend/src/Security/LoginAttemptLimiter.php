<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

use PersiaCoder\PosV3\Http\HttpException;

final readonly class LoginAttemptLimiter
{
    private const ACCOUNT_MAX_ATTEMPTS = 5;
    private const IP_MAX_ATTEMPTS = 30;

    public function __construct(
        private LoginAttemptStore $records,
        private string $applicationKey,
    ) {
        if (strlen($this->applicationKey) < 32) {
            throw new \InvalidArgumentException('Application key must contain at least 32 bytes.');
        }
    }

    public function assertAllowed(string $username, string $ipAddress): void
    {
        [$accountHash, $ipHash] = $this->identifierHashes($username, $ipAddress);
        if ($this->records->isBlocked($accountHash, $ipHash)) {
            throw new HttpException(429, 'login_rate_limited', 'Too many login attempts. Try again later.');
        }
    }

    public function recordFailure(string $username, string $ipAddress): void
    {
        [$accountHash, $ipHash] = $this->identifierHashes($username, $ipAddress);
        $this->records->recordFailure(
            $accountHash,
            $ipHash,
            self::ACCOUNT_MAX_ATTEMPTS,
            self::IP_MAX_ATTEMPTS,
        );
    }

    public function clear(string $username, string $ipAddress): void
    {
        [$accountHash] = $this->identifierHashes($username, $ipAddress);
        $this->records->clear($accountHash);
    }

    /** @return array{string, string|null} */
    private function identifierHashes(string $username, string $ipAddress): array
    {
        $normalizedUsername = strtolower(trim($username));
        $accountHash = hash_hmac('sha256', 'account' . "\0" . $normalizedUsername, $this->applicationKey);
        $normalizedIp = filter_var($ipAddress, FILTER_VALIDATE_IP) ? $ipAddress : null;
        $ipHash = $normalizedIp === null
            ? null
            : hash_hmac('sha256', 'ip' . "\0" . $normalizedIp, $this->applicationKey);

        return [$accountHash, $ipHash];
    }
}
