<?php
declare(strict_types=1);

return [
    'module' => 'Auth',
    'required' => ["src/Auth/AuthenticationService.php","src/Auth/BusinessSetupService.php","src/Auth/BranchManagementService.php","src/Auth/RoleManagementService.php","src/Auth/UserManagementService.php","src/Auth/BusinessStore.php","src/Auth/UserStore.php","src/Auth/RoleStore.php","src/Auth/SessionStore.php","src/Auth/PermissionStore.php"],
    'services' => ["src/Auth/AuthenticationService.php","src/Auth/BusinessSetupService.php","src/Auth/BranchManagementService.php","src/Auth/RoleManagementService.php","src/Auth/UserManagementService.php"],
    'forbidden' => ["use PDO;","Infrastructure\\\\Database"],
];
