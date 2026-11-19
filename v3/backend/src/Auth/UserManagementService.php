<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use PDO;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\RoleRepository;
use PersiaCoder\PosV3\Infrastructure\Database\TransactionManager;
use PersiaCoder\PosV3\Infrastructure\Database\AuditLogRepository;
use PersiaCoder\PosV3\Security\AuditLogService;
use PersiaCoder\PosV3\Infrastructure\Database\UserRepository;

final readonly class UserManagementService
{
    private UserRepository $users;
    private RoleRepository $roles;
    private TransactionManager $transactions;
    private AuditLogService $audit;

    public function __construct(
        private PDO $connection,
        private PermissionService $permissions,
    ) {
        $this->users = new UserRepository($connection);
        $this->roles = new RoleRepository($connection);
        $this->transactions = new TransactionManager($connection);
        $this->audit = new AuditLogService(new AuditLogRepository($connection));
    }

    public function listBusinessUsers(BusinessScope $scope): array
    {
        return $this->users->listBusinessUsers($scope->businessId);
    }

    public function listBranchUsers(BusinessScope $scope): array
    {
        if ($scope->branchId === null) {
            throw new HttpException(400, 'branch_context_required', 'A branch scope is required.');
        }
        return $this->users->listBranchUsers($scope->businessId, $scope->branchId);
    }

    /** @return array{user_id:string,username:string,display_name:string,role_code:string,temporary_password:string} */
    public function createBusinessUser(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        string $username,
        string $displayName,
        string $roleCode,
        string $requestId,
        string $ipAddress,
    ): array {
        return $this->create($actor, $scope, $username, $displayName, $roleCode, false, $requestId, $ipAddress);
    }

    /** @return array{user_id:string,username:string,display_name:string,role_code:string,temporary_password:string} */
    public function createBranchUser(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        string $username,
        string $displayName,
        string $roleCode,
        string $requestId,
        string $ipAddress,
    ): array {
        if ($scope->branchId === null) {
            throw new HttpException(400, 'branch_context_required', 'A branch scope is required.');
        }
        return $this->create($actor, $scope, $username, $displayName, $roleCode, true, $requestId, $ipAddress);
    }

    private function create(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        string $username,
        string $displayName,
        string $roleCode,
        bool $branchScoped,
        string $requestId,
        string $ipAddress,
    ): array {
        $username = strtolower(trim($username));
        $displayName = trim($displayName);
        $roleCode = trim($roleCode);

        if (!preg_match('/^[a-z0-9][a-z0-9._-]{2,63}$/', $username)) {
            throw new HttpException(422, 'invalid_username', 'Username must contain 3-64 lowercase letters, digits, dots, underscores or hyphens.');
        }
        if ($displayName === '' || self::unicodeLength($displayName) > 120) {
            throw new HttpException(422, 'invalid_display_name', 'Display name is required and must not exceed 120 characters.');
        }
        if ($this->users->usernameExists($username)) {
            throw new HttpException(409, 'username_already_exists', 'The username is already in use.');
        }

        if (!preg_match('/^[a-z][a-z0-9_-]{1,63}$/', $roleCode)) {
            throw new HttpException(400, 'role_code_invalid', 'The role code is invalid.');
        }
        $role = $this->roles->findActiveRole($roleCode);
        if ($role === null) {
            throw new HttpException(404, 'role_not_found', 'The role was not found.');
        }
        if ($role['code'] === 'owner' || in_array('*', $role['permissions'], true)) {
            throw new HttpException(403, 'protected_role_assignment', 'The installation owner role cannot be assigned to a new user.');
        }
        foreach ($role['permissions'] as $permissionCode) {
            if (!$this->permissions->allows($actor, $permissionCode, $scope)) {
                throw new HttpException(403, 'role_escalation_denied', 'You cannot create a user with permissions you do not hold.');
            }
        }

        $publicId = self::uuidV4();
        $temporaryPassword = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $passwordHash = password_hash($temporaryPassword, PASSWORD_DEFAULT);

        $this->transactions->run(function (PDO $connection) use (
            $publicId,
            $username,
            $passwordHash,
            $displayName,
            $role,
            $actor,
            $scope,
            $branchScoped,
            $requestId,
            $ipAddress,
        ): void {
            $userId = $this->users->createUser($publicId, $username, $passwordHash, $displayName);
            if ($branchScoped) {
                $this->roles->assignBranchRole($userId, (int) $scope->branchId, $role['id'], $actor->userId);
            } else {
                $this->roles->assignBusinessRole($userId, $scope->businessId, $role['id'], $actor->userId);
            }
            $this->audit->record(
                $actor->userId,
                'user.created',
                'user',
                $publicId,
                null,
                [
                    'username' => $username,
                    'display_name' => $displayName,
                    'role_code' => $roleCode,
                    'scope' => $branchScoped ? 'branch' : 'business',
                    'business_id' => $scope->businessPublicId,
                    'branch_id' => $scope->branchPublicId,
                ],
                null,
                $requestId,
                $ipAddress,
            );
        });

        return [
            'user_id' => $publicId,
            'username' => $username,
            'display_name' => $displayName,
            'role_code' => $roleCode,
            'temporary_password' => $temporaryPassword,
        ];
    }

    private static function unicodeLength(string $value): int
    {
        $count = preg_match_all('/./us', $value);
        return $count === false ? PHP_INT_MAX : $count;
    }

    private static function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-'
            . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }
}
