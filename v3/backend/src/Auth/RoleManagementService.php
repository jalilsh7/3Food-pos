<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use PDO;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\RoleRepository;
use PersiaCoder\PosV3\Infrastructure\Database\TransactionManager;

final readonly class RoleManagementService
{
    private TransactionManager $transactions;

    public function __construct(
        PDO $connection,
        private RoleRepository $roles,
        private PermissionService $permissions,
    ) {
        $this->transactions = new TransactionManager($connection);
    }

    public function listRoles(): array
    {
        return $this->roles->listActiveRoles();
    }

    public function listPermissions(): array
    {
        return $this->roles->listActivePermissions();
    }

    public function createCustomRole(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        string $code,
        string $name,
        array $permissionCodes,
    ): void {
        $code = strtolower(trim($code));
        $name = trim($name);
        $permissionCodes = $this->validatePermissionCodes($permissionCodes);
        if (!preg_match('/^[a-z][a-z0-9_-]{1,63}$/', $code) || $code === 'owner') {
            throw new HttpException(422, 'role_code_invalid', 'The custom role code is invalid.');
        }
        if ($name === '' || self::unicodeLength($name) > 100) {
            throw new HttpException(422, 'role_name_invalid', 'Role name is required and must not exceed 100 characters.');
        }
        if ($this->roles->findActiveRole($code) !== null) {
            throw new HttpException(409, 'role_code_exists', 'A role with this code already exists.');
        }

        $permissionIds = $this->authorizePermissionSet($actor, $scope, $permissionCodes);
        $this->transactions->run(function (PDO $connection) use ($code, $name, $permissionIds): void {
            $roleId = $this->roles->createCustomRole($code, $name);
            $this->roles->replaceRolePermissions($roleId, $permissionIds);
        });
    }

    public function updateCustomRole(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        string $code,
        string $name,
        array $permissionCodes,
    ): void {
        $code = strtolower(trim($code));
        $name = trim($name);
        $permissionCodes = $this->validatePermissionCodes($permissionCodes);
        $role = $this->roles->findActiveRole($code);
        if ($role === null) {
            throw new HttpException(404, 'role_not_found', 'The role was not found.');
        }
        if ($role['code'] === 'owner' || $this->roles->isSystemRole($code)) {
            throw new HttpException(403, 'system_role_immutable', 'System roles cannot be modified.');
        }
        if ($name === '' || self::unicodeLength($name) > 100) {
            throw new HttpException(422, 'role_name_invalid', 'Role name is required and must not exceed 100 characters.');
        }

        $permissionIds = $this->authorizePermissionSet($actor, $scope, $permissionCodes);
        $this->transactions->run(function (PDO $connection) use ($role, $name, $permissionIds): void {
            $this->roles->updateCustomRoleName($role['id'], $name);
            $this->roles->replaceRolePermissions($role['id'], $permissionIds);
        });
    }

    public function assignBusinessRole(
        AuthenticatedPrincipal $actor,
        string $targetUserPublicId,
        string $roleCode,
        BusinessScope $scope,
    ): void {
        $this->assign($actor, $targetUserPublicId, $roleCode, $scope, false);
    }

    public function assignBranchRole(
        AuthenticatedPrincipal $actor,
        string $targetUserPublicId,
        string $roleCode,
        BusinessScope $scope,
    ): void {
        if ($scope->branchId === null) {
            throw new HttpException(400, 'branch_context_required', 'A branch scope is required.');
        }
        $this->assign($actor, $targetUserPublicId, $roleCode, $scope, true);
    }

    public function removeBusinessRole(
        string $targetUserPublicId,
        string $roleCode,
        BusinessScope $scope,
    ): bool {
        $targetId = $this->resolveTarget($targetUserPublicId);
        $role = $this->resolveRole($roleCode);
        return $this->roles->removeBusinessRole($targetId, $scope->businessId, $role['id']);
    }

    public function removeBranchRole(
        string $targetUserPublicId,
        string $roleCode,
        BusinessScope $scope,
    ): bool {
        if ($scope->branchId === null) {
            throw new HttpException(400, 'branch_context_required', 'A branch scope is required.');
        }
        $targetId = $this->resolveTarget($targetUserPublicId);
        $role = $this->resolveRole($roleCode);
        return $this->roles->removeBranchRole($targetId, $scope->branchId, $role['id']);
    }

    private function assign(
        AuthenticatedPrincipal $actor,
        string $targetUserPublicId,
        string $roleCode,
        BusinessScope $scope,
        bool $branchScoped,
    ): void {
        $targetId = $this->resolveTarget($targetUserPublicId);
        $role = $this->resolveRole($roleCode);
        if ($role['code'] === 'owner' || in_array('*', $role['permissions'], true)) {
            throw new HttpException(403, 'protected_role_assignment', 'The installation owner role cannot be assigned through scoped role management.');
        }

        $this->authorizePermissionSet($actor, $scope, $role['permissions']);
        if ($branchScoped) {
            $this->roles->assignBranchRole($targetId, (int) $scope->branchId, $role['id'], $actor->userId);
            return;
        }
        $this->roles->assignBusinessRole($targetId, $scope->businessId, $role['id'], $actor->userId);
    }

    /** @return list<int> */
    private function authorizePermissionSet(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        array $permissionCodes,
    ): array {
        if ($permissionCodes === [] || count($permissionCodes) > 64) {
            throw new HttpException(422, 'permission_set_invalid', 'A role must contain between 1 and 64 permissions.');
        }

        $idsByCode = $this->roles->findPermissionIdsByCodes($permissionCodes);
        if (count($idsByCode) !== count($permissionCodes)) {
            throw new HttpException(422, 'permission_unknown', 'The permission set contains an unknown permission.');
        }

        foreach ($permissionCodes as $permissionCode) {
            if ($permissionCode === '*' || !$this->permissions->allows($actor, $permissionCode, $scope)) {
                throw new HttpException(403, 'permission_delegation_denied', 'You cannot grant a permission you do not hold.');
            }
        }

        return array_values($idsByCode);
    }

    /** @return list<string> */
    private function validatePermissionCodes(array $permissionCodes): array
    {
        if (!array_is_list($permissionCodes)) {
            throw new HttpException(422, 'permission_set_invalid', 'Permissions must be a list of permission codes.');
        }
        $normalized = [];
        foreach ($permissionCodes as $permissionCode) {
            if (!is_string($permissionCode) || !preg_match('/^[a-z][a-z0-9_.-]{1,99}$/', $permissionCode)) {
                throw new HttpException(422, 'permission_code_invalid', 'A permission code is invalid.');
            }
            $normalized[] = $permissionCode;
        }
        if (count($normalized) !== count(array_unique($normalized))) {
            throw new HttpException(422, 'permission_set_duplicate', 'A permission code may only appear once.');
        }
        return $normalized;
    }

    private function resolveTarget(string $publicId): int
    {
        if (!self::isUuid($publicId)) {
            throw new HttpException(400, 'user_id_invalid', 'The target user identifier is invalid.');
        }
        $userId = $this->roles->findActiveUserId($publicId);
        if ($userId === null) {
            throw new HttpException(404, 'user_not_found', 'The target user was not found.');
        }
        return $userId;
    }

    /** @return array{id:int,code:string,name:string,permissions:list<string>} */
    private function resolveRole(string $code): array
    {
        if (!preg_match('/^[a-z][a-z0-9_-]{1,63}$/', $code)) {
            throw new HttpException(400, 'role_code_invalid', 'The role code is invalid.');
        }
        $role = $this->roles->findActiveRole($code);
        if ($role === null) {
            throw new HttpException(404, 'role_not_found', 'The role was not found.');
        }
        return $role;
    }

    private static function unicodeLength(string $value): int
    {
        $count = preg_match_all('/./us', $value);
        return $count === false ? PHP_INT_MAX : $count;
    }

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }
}
