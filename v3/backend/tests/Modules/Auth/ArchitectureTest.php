<?php
declare(strict_types=1);

return [
    'module' => 'Auth',
    'required' => ['src/Auth/AuthenticationService.php', 'src/Auth/AuthenticationApplication.php', 'src/Auth/BusinessSetupService.php', 'src/Auth/BusinessSetupApplication.php', 'src/Auth/BranchManagementService.php', 'src/Auth/BranchManagementApplication.php', 'src/Auth/RoleManagementService.php', 'src/Auth/RoleManagementApplication.php', 'src/Auth/UserManagementService.php', 'src/Auth/UserManagementApplication.php', 'src/Auth/BusinessStore.php', 'src/Auth/UserStore.php', 'src/Auth/RoleStore.php', 'src/Auth/SessionStore.php', 'src/Auth/PermissionStore.php'],
    'services' => ['src/Auth/AuthenticationService.php', 'src/Auth/BusinessSetupService.php', 'src/Auth/BranchManagementService.php', 'src/Auth/RoleManagementService.php', 'src/Auth/UserManagementService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure'],
    'contains' => [],
    'checks' => [
        ['src/Auth/AuthenticationService.php', ['implements AuthenticationApplication'], []],
        ['src/Auth/BusinessSetupService.php', ['implements BusinessSetupApplication'], []],
        ['src/Auth/BranchManagementService.php', ['implements BranchManagementApplication'], []],
        ['src/Auth/RoleManagementService.php', ['implements RoleManagementApplication'], []],
        ['src/Auth/UserManagementService.php', ['implements UserManagementApplication'], []],
        ['src/Auth/AuthController.php', ['AuthenticationApplication $authentication'], []],
        ['src/Auth/AuthenticationApplication.php', ['interface AuthenticationApplication'], ['$this->']],
        ['src/Auth/BusinessSetupApplication.php', ['interface BusinessSetupApplication'], ['$this->']],
        ['src/Auth/BranchManagementApplication.php', ['interface BranchManagementApplication'], ['$this->']],
        ['src/Auth/RoleManagementApplication.php', ['interface RoleManagementApplication'], ['$this->']],
        ['src/Auth/UserManagementApplication.php', ['interface UserManagementApplication'], ['$this->']],
    ],
];
