<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\RoleRepository;

final readonly class RoleManagementService
{
    public function __construct(
        private RoleRepository $roles,
        private PermissionService $permissions,
    ) {}

    public function listRoles(): array
    {
        return $this->roles->listActiveRoles();
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

        foreach ($role['permissions'] as $permissionCode) {
            if (!$this->permissions->allows($actor, $permissionCode, $scope)) {
                throw new HttpException(403, 'role_escalation_denied', 'You cannot assign a role with permissions you do not hold.');
            }
        }

        if ($branchScoped) {
            $this->roles->assignBranchRole($targetId, (int) $scope->branchId, $role['id'], $actor->userId);
            return;
        }

        $this->roles->assignBusinessRole($targetId, $scope->businessId, $role['id'], $actor->userId);
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

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }
}
