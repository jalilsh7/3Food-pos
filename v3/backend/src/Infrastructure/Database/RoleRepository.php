<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class RoleRepository
{
    public function __construct(private PDO $connection) {}

    /** @return list<array{id:int,code:string,name:string,is_system:bool,permissions:list<string>}> */
    public function listActiveRoles(): array
    {
        $statement = $this->connection->query(
            'SELECT r.id, r.code, r.name, r.is_system, p.code AS permission_code
             FROM app_roles r
             LEFT JOIN app_role_permissions rp ON rp.role_id = r.id
             LEFT JOIN app_permissions p ON p.id = rp.permission_id
             WHERE r.is_active = 1
             ORDER BY r.is_system DESC, r.name ASC, p.code ASC'
        );

        $roles = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $id = (int) $row['id'];
            if (!isset($roles[$id])) {
                $roles[$id] = [
                    'id' => $id,
                    'code' => (string) $row['code'],
                    'name' => (string) $row['name'],
                    'is_system' => (int) $row['is_system'] === 1,
                    'permissions' => [],
                ];
            }
            if (is_string($row['permission_code'])) {
                $roles[$id]['permissions'][] = $row['permission_code'];
            }
        }

        return array_values($roles);
    }

    /** @return array{id:int,code:string,name:string,permissions:list<string>}|null */
    public function findActiveRole(string $code): ?array
    {
        $statement = $this->connection->prepare(
            'SELECT r.id, r.code, r.name, p.code AS permission_code
             FROM app_roles r
             LEFT JOIN app_role_permissions rp ON rp.role_id = r.id
             LEFT JOIN app_permissions p ON p.id = rp.permission_id
             WHERE r.code = :role_code AND r.is_active = 1
             ORDER BY p.code ASC'
        );
        $statement->execute(['role_code' => $code]);

        $role = null;
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($role === null) {
                $role = [
                    'id' => (int) $row['id'],
                    'code' => (string) $row['code'],
                    'name' => (string) $row['name'],
                    'permissions' => [],
                ];
            }
            if (is_string($row['permission_code'])) {
                $role['permissions'][] = $row['permission_code'];
            }
        }
        return $role;
    }

    public function findActiveUserId(string $publicId): ?int
    {
        $statement = $this->connection->prepare(
            'SELECT id FROM app_users
             WHERE public_id = :public_id AND is_active = 1
             LIMIT 1'
        );
        $statement->execute(['public_id' => $publicId]);
        $value = $statement->fetchColumn();
        return $value === false ? null : (int) $value;
    }

    public function assignBusinessRole(int $userId, int $businessId, int $roleId, int $assignedBy): void
    {
        $statement = $this->connection->prepare(
            'INSERT IGNORE INTO app_user_business_roles (user_id, business_id, role_id, assigned_by)
             VALUES (:user_id, :business_id, :role_id, :assigned_by)'
        );
        $statement->execute([
            'user_id' => $userId,
            'business_id' => $businessId,
            'role_id' => $roleId,
            'assigned_by' => $assignedBy,
        ]);
    }

    public function assignBranchRole(int $userId, int $branchId, int $roleId, int $assignedBy): void
    {
        $statement = $this->connection->prepare(
            'INSERT IGNORE INTO app_user_branch_roles (user_id, branch_id, role_id, assigned_by)
             VALUES (:user_id, :branch_id, :role_id, :assigned_by)'
        );
        $statement->execute([
            'user_id' => $userId,
            'branch_id' => $branchId,
            'role_id' => $roleId,
            'assigned_by' => $assignedBy,
        ]);
    }

    public function removeBusinessRole(int $userId, int $businessId, int $roleId): bool
    {
        $statement = $this->connection->prepare(
            'DELETE FROM app_user_business_roles
             WHERE user_id = :user_id AND business_id = :business_id AND role_id = :role_id'
        );
        $statement->execute(['user_id' => $userId, 'business_id' => $businessId, 'role_id' => $roleId]);
        return $statement->rowCount() > 0;
    }

    public function removeBranchRole(int $userId, int $branchId, int $roleId): bool
    {
        $statement = $this->connection->prepare(
            'DELETE FROM app_user_branch_roles
             WHERE user_id = :user_id AND branch_id = :branch_id AND role_id = :role_id'
        );
        $statement->execute(['user_id' => $userId, 'branch_id' => $branchId, 'role_id' => $roleId]);
        return $statement->rowCount() > 0;
    }
}
