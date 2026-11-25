<?php
declare(strict_types=1);

return [
    'module' => 'Catalog',
    'required' => ["src/Catalog/CatalogService.php","src/Catalog/CatalogStore.php","src/Infrastructure/Database/CatalogRepository.php"],
    'services' => ["src/Catalog/CatalogService.php"],
    'forbidden' => ["use PDO;","Infrastructure\\\\Database","\\\\Auth\\\\","\\\\Http\\\\"],
];
