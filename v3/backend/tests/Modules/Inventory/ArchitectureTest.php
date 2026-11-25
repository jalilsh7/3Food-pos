<?php
declare(strict_types=1);

return [
    'module' => 'Inventory',
    'required' => ["src/Inventory/InventoryService.php","src/Inventory/InventoryStore.php","src/Inventory/InventoryDocumentStore.php","src/Inventory/InventoryPostingStore.php","src/Inventory/SupplierStore.php"],
    'services' => ["src/Inventory/InventoryService.php","src/Inventory/InventoryDocumentService.php","src/Inventory/InventoryPostingService.php","src/Inventory/SupplierService.php"],
    'forbidden' => ["use PDO;","Infrastructure\\\\Database","\\\\Auth\\\\","\\\\Http\\\\"],
];
