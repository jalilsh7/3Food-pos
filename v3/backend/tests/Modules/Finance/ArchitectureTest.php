<?php
declare(strict_types=1);

return [
    'module' => 'Finance',
    'required' => ['src/Finance/CashRegisterService.php', 'src/Finance/CashRegisterApplication.php', 'src/Finance/CashStore.php', 'src/Infrastructure/Database/CashRepository.php'],
    'services' => ['src/Finance/CashRegisterService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http', 'AuditLogService', 'IdempotencyService'],
    'contains' => [],
    'checks' => [
        ['src/Finance/CashRegisterService.php', ['implements CashRegisterApplication'], []],
        ['src/Finance/CashRegisterController.php', ['CashRegisterApplication $cash'], []],
        ['src/Finance/CashRegisterApplication.php', ['interface CashRegisterApplication'], ['$this->']],
    ],
];
