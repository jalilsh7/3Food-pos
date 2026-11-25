<?php
declare(strict_types=1);

return [
    'module' => 'Finance',
    'required' => ["src/Finance/CashRegisterService.php","src/Finance/CashStore.php","src/Infrastructure/Database/CashRepository.php"],
    'services' => ["src/Finance/CashRegisterService.php"],
    'forbidden' => ["use PDO;","Infrastructure\\\\Database","\\\\Auth\\\\","\\\\Http\\\\"],
];
