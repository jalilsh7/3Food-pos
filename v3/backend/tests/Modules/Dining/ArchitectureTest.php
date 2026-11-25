<?php
declare(strict_types=1);

return [
    'module' => 'Dining',
    'required' => ["src/Dining/DiningService.php","src/Dining/DiningStore.php","src/Infrastructure/Database/DiningRepository.php"],
    'services' => ["src/Dining/DiningService.php"],
    'forbidden' => ["use PDO;","Infrastructure\\\\Database","\\\\Auth\\\\","\\\\Http\\\\"],
];
