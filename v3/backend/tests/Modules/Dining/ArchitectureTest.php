<?php
declare(strict_types=1);

return [
    'module' => 'Dining',
    'required' => ['src/Dining/DiningService.php', 'src/Dining/DiningApplication.php', 'src/Dining/DiningStore.php', 'src/Infrastructure/Database/DiningRepository.php'],
    'services' => ['src/Dining/DiningService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http'],
    'contains' => [],
    'checks' => [
        ['src/Dining/DiningService.php', ['implements DiningApplication'], []],
        ['src/Dining/DiningController.php', ['DiningApplication $dining'], []],
        ['src/Dining/DiningApplication.php', ['interface DiningApplication'], ['$this->']],
    ],
];
