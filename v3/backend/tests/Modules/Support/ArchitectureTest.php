<?php
declare(strict_types=1);

return [
    'module' => 'Support',
    'required' => ['src/Support/Logger.php', 'src/Support/ApplicationException.php'],
    'services' => ['src/Support/Logger.php', 'src/Support/ApplicationException.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Http', 'Auth'],
    'contains' => [],
];
