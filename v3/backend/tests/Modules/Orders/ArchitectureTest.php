<?php
declare(strict_types=1);

return [
    'module' => 'Orders',
    'required' => ['src/Orders/OrderService.php', 'src/Orders/OrderApplication.php', 'src/Orders/OrderStore.php', 'src/Security/ActorContext.php', 'src/Security/BusinessContext.php', 'src/Security/PermissionChecker.php'],
    'services' => ['src/Orders/OrderService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http'],
    'contains' => [],
    'checks' => [
        ['src/Orders/OrderService.php', ['implements OrderApplication'], []],
        ['src/Orders/OrderController.php', ['OrderApplication $orders'], []],
        ['src/Orders/OrderApplication.php', ['interface OrderApplication'], ['$this->']],
    ],
];
