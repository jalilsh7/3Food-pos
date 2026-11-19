<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class UserRepository
{
    public function __construct(private PDO $connection) {}

    /** @return array<string, mixed>|null */
    public function findByUsername(string $username): ?array
    {
        $statement = $this->connection->prepare(
            'SELECT id, public_id, username, password_hash, display_name,
                    is_active, must_change_password, session_version
             FROM app_users
             WHERE username = :username
             LIMIT 1'
        );
        $statement->execute(['username' => $username]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($user) ? $user : null;
    }

    /** @return array<string, mixed>|null */
    public function findActiveById(int $userId): ?array
    {
        $statement = $this->connection->prepare(
            'SELECT id, password_hash, is_active
             FROM app_users
             WHERE id = :user_id
             LIMIT 1'
        );
        $statement->execute(['user_id' => $userId]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($user) && (int) $user['is_active'] === 1 ? $user : null;
    }

    public function updatePasswordHash(int $userId, string $passwordHash): void
    {
        $statement = $this->connection->prepare(
            'UPDATE app_users SET password_hash = :password_hash WHERE id = :user_id'
        );
        $statement->execute(['password_hash' => $passwordHash, 'user_id' => $userId]);
    }

    public function changePasswordAndRevokeSessions(int $userId, string $passwordHash): void
    {
        $statement = $this->connection->prepare(
            'UPDATE app_users
             SET password_hash = :password_hash,
                 must_change_password = 0,
                 session_version = session_version + 1
             WHERE id = :user_id AND is_active = 1'
        );
        $statement->execute(['password_hash' => $passwordHash, 'user_id' => $userId]);
    }

    public function touchLastLogin(int $userId): void
    {
        $statement = $this->connection->prepare(
            'UPDATE app_users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = :user_id AND is_active = 1'
        );
        $statement->execute(['user_id' => $userId]);
    }
}
