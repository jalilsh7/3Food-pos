<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

use PDO;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\TransactionManager;

final readonly class LoginAttemptLimiter
{
    private const MAX_ATTEMPTS = 5;

    public function __construct(
        private PDO $connection,
        private TransactionManager $transactions,
        private string $applicationKey,
    ) {}

    public function assertAllowed(string $username, string $ipAddress): void
    {
        $identifierHash = $this->identifierHash($username, $ipAddress);
        $statement = $this->connection->prepare(
            'SELECT 1 FROM app_auth_login_attempts
             WHERE identifier_hash = :identifier_hash
               AND blocked_until IS NOT NULL
               AND blocked_until > UTC_TIMESTAMP(3)
             LIMIT 1'
        );
        $statement->execute(['identifier_hash' => $identifierHash]);

        if ($statement->fetchColumn() !== false) {
            throw new HttpException(429, 'login_rate_limited', 'Too many login attempts. Try again later.');
        }
    }

    public function recordFailure(string $username, string $ipAddress): void
    {
        $identifierHash = $this->identifierHash($username, $ipAddress);

        $this->transactions->run(function (PDO $connection) use ($identifierHash): void {
            $insert = $connection->prepare(
                'INSERT IGNORE INTO app_auth_login_attempts (identifier_hash, attempts, window_started_at)
                 VALUES (:identifier_hash, 0, UTC_TIMESTAMP(3))'
            );
            $insert->execute(['identifier_hash' => $identifierHash]);

            $select = $connection->prepare(
                'SELECT attempts,
                        (window_started_at < UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE) AS window_expired
                 FROM app_auth_login_attempts
                 WHERE identifier_hash = :identifier_hash
                 FOR UPDATE'
            );
            $select->execute(['identifier_hash' => $identifierHash]);
            $row = $select->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                throw new \RuntimeException('Login attempt state could not be locked.');
            }

            $expired = (int) $row['window_expired'] === 1;
            $attempts = ($expired ? 0 : (int) $row['attempts']) + 1;
            $blocked = $attempts >= self::MAX_ATTEMPTS;

            $update = $connection->prepare(
                'UPDATE app_auth_login_attempts
                 SET attempts = :attempts,
                     window_started_at = IF(:window_expired = 1, UTC_TIMESTAMP(3), window_started_at),
                     blocked_until = CASE
                         WHEN :blocked = 1 THEN DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE)
                         WHEN :window_expired = 1 THEN NULL
                         ELSE blocked_until
                     END
                 WHERE identifier_hash = :identifier_hash'
            );
            $update->execute([
                'attempts' => $attempts,
                'window_expired' => $expired ? 1 : 0,
                'blocked' => $blocked ? 1 : 0,
                'identifier_hash' => $identifierHash,
            ]);
        });
    }

    public function clear(string $username, string $ipAddress): void
    {
        $statement = $this->connection->prepare(
            'DELETE FROM app_auth_login_attempts WHERE identifier_hash = :identifier_hash'
        );
        $statement->execute(['identifier_hash' => $this->identifierHash($username, $ipAddress)]);
    }

    private function identifierHash(string $username, string $ipAddress): string
    {
        $normalizedUsername = strtolower(trim($username));
        $normalizedIp = filter_var($ipAddress, FILTER_VALIDATE_IP) ? $ipAddress : 'unknown';
        return hash_hmac('sha256', $normalizedUsername . "\0" . $normalizedIp, $this->applicationKey);
    }
}
