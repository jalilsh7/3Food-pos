<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class BusinessRepository
{
    public function __construct(private PDO $connection) {}

    public function countBusinesses(): int
    {
        return (int) $this->connection->query('SELECT COUNT(*) FROM pos_businesses')->fetchColumn();
    }

    public function isInstallationOwner(int $userId): bool
    {
        $statement = $this->connection->prepare(
            "SELECT 1
             FROM app_user_roles ur
             INNER JOIN app_roles r ON r.id = ur.role_id
             WHERE ur.user_id = :user_id AND r.code = 'owner' AND r.is_active = 1
             LIMIT 1"
        );
        $statement->execute(['user_id' => $userId]);
        return $statement->fetchColumn() !== false;
    }

    public function createBusiness(
        string $publicId,
        string $code,
        string $name,
        string $timezone,
        string $currency,
    ): int {
        $statement = $this->connection->prepare(
            'INSERT INTO pos_businesses (public_id, code, name, timezone, currency)
             VALUES (:public_id, :code, :name, :timezone, :currency)'
        );
        $statement->execute([
            'public_id' => $publicId,
            'code' => $code,
            'name' => $name,
            'timezone' => $timezone,
            'currency' => $currency,
        ]);
        return (int) $this->connection->lastInsertId();
    }

    public function createBranch(
        string $publicId,
        int $businessId,
        string $code,
        string $name,
        ?string $timezone,
    ): int {
        $statement = $this->connection->prepare(
            'INSERT INTO pos_branches (public_id, business_id, code, name, timezone)
             VALUES (:public_id, :business_id, :code, :name, :timezone)'
        );
        $statement->execute([
            'public_id' => $publicId,
            'business_id' => $businessId,
            'code' => $code,
            'name' => $name,
            'timezone' => $timezone,
        ]);
        return (int) $this->connection->lastInsertId();
    }
}
