<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;
use PersiaCoder\PosV3\Security\LoginAttemptStore;

final readonly class LoginAttemptRepository implements LoginAttemptStore
{
    public function __construct(
        private PDO $connection,
        private TransactionManager $transactions,
    ) {}

    public function isBlocked(string $accountHash, ?string $ipHash): bool
    {
        $statement = $this->connection->prepare(
            'SELECT 1 FROM app_auth_login_attempts
             WHERE identifier_hash IN (:account_hash, :ip_hash)
               AND blocked_until IS NOT NULL
               AND blocked_until > UTC_TIMESTAMP(3)
             LIMIT 1'
        );
        $statement->execute(['account_hash' => $accountHash, 'ip_hash' => $ipHash]);
        return $statement->fetchColumn() !== false;
    }

    public function recordFailure(
        string $accountHash,
        ?string $ipHash,
        int $accountMaxAttempts,
        int $ipMaxAttempts,
    ): void {
        $this->transactions->run(function () use (
            $accountHash,
            $ipHash,
            $accountMaxAttempts,
            $ipMaxAttempts,
        ): void {
            $this->incrementBucket($accountHash, $accountMaxAttempts);
            if ($ipHash !== null) {
                $this->incrementBucket($ipHash, $ipMaxAttempts);
            }
        });
    }

    public function clear(string $accountHash): void
    {
        $statement = $this->connection->prepare(
            'DELETE FROM app_auth_login_attempts WHERE identifier_hash = :identifier_hash'
        );
        $statement->execute(['identifier_hash' => $accountHash]);
    }

    private function incrementBucket(string $identifierHash, int $maxAttempts): void
    {
        $insert = $this->connection->prepare(
            'INSERT IGNORE INTO app_auth_login_attempts (identifier_hash, attempts, window_started_at)
             VALUES (:identifier_hash, 0, UTC_TIMESTAMP(3))'
        );
        $insert->execute(['identifier_hash' => $identifierHash]);

        $select = $this->connection->prepare(
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
        $blocked = $attempts >= $maxAttempts;

        $update = $this->connection->prepare(
            'UPDATE app_auth_login_attempts
             SET attempts = :attempts,
                 window_started_at = IF(:reset_window_start = 1, UTC_TIMESTAMP(3), window_started_at),
                 blocked_until = CASE
                     WHEN :blocked = 1 THEN DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE)
                     WHEN :reset_window_block = 1 THEN NULL
                     ELSE blocked_until
                 END
             WHERE identifier_hash = :identifier_hash'
        );
        $update->execute([
            'attempts' => $attempts,
            'reset_window_start' => $expired ? 1 : 0,
            'reset_window_block' => $expired ? 1 : 0,
            'blocked' => $blocked ? 1 : 0,
            'identifier_hash' => $identifierHash,
        ]);
    }
}
