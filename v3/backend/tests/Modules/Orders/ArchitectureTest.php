<?php
declare(strict_types=1);

return [
    'module' => 'Orders',
    'required' => ['src/Orders/OrderService.php', 'src/Orders/OrderStore.php', 'src/Security/ActorContext.php', 'src/Security/BusinessContext.php', 'src/Security/PermissionChecker.php'],
    'services' => ['src/Orders/OrderService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http'],
];
