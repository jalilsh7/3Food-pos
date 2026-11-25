<?php
declare(strict_types=1);

return [
    'module' => 'Infrastructure',
    'required' => [
        'src/Infrastructure/Database/TransactionManager.php',
        'src/Infrastructure/Logging/ErrorLogLogger.php',
        'src/Infrastructure/Storage/PrivateMediaStorage.php',
        '../../database/v3/bin/migrate.php',
        '../../database/v3/migrations/manifest.php',
    ],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Infrastructure/Database/TransactionManager.php', ['PDO'], []],
        ['src/Infrastructure/Logging/ErrorLogLogger.php', ['implements Logger', 'POS_V3_LOG_MODULES'], []],
        ['src/Infrastructure/Storage/PrivateMediaStorage.php', ['implements MediaStorage'], []],
        ['src/Infrastructure/Database/OrderRepository.php', ['implements OrderStore'], []],
    ],
];
