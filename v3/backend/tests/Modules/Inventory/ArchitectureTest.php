<?php
declare(strict_types=1);

return [
    'module' => 'Inventory',
    'required' => ['src/Inventory/InventoryService.php', 'src/Inventory/InventoryApplication.php', 'src/Inventory/InventoryDocumentService.php', 'src/Inventory/InventoryDocumentApplication.php', 'src/Inventory/InventoryPostingService.php', 'src/Inventory/InventoryPostingApplication.php', 'src/Inventory/SupplierService.php', 'src/Inventory/SupplierApplication.php', 'src/Inventory/InventoryStore.php', 'src/Inventory/InventoryDocumentStore.php', 'src/Inventory/InventoryPostingStore.php', 'src/Inventory/SupplierStore.php'],
    'services' => ['src/Inventory/InventoryService.php', 'src/Inventory/InventoryDocumentService.php', 'src/Inventory/InventoryPostingService.php', 'src/Inventory/SupplierService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http', 'AuditLogService', 'IdempotencyService'],
    'contains' => [],
    'checks' => [
        ['src/Inventory/InventoryService.php', ['implements InventoryApplication'], []],
        ['src/Inventory/InventoryDocumentService.php', ['implements InventoryDocumentApplication'], []],
        ['src/Inventory/InventoryPostingService.php', ['implements InventoryPostingApplication'], []],
        ['src/Inventory/SupplierService.php', ['implements SupplierApplication'], []],
        ['src/Inventory/InventoryController.php', ['InventoryApplication $inventory', 'InventoryDocumentApplication $documents', 'InventoryPostingApplication $posting', 'SupplierApplication $suppliers'], []],
        ['src/Inventory/InventoryApplication.php', ['interface InventoryApplication'], ['$this->']],
        ['src/Inventory/InventoryDocumentApplication.php', ['interface InventoryDocumentApplication'], ['$this->']],
        ['src/Inventory/InventoryPostingApplication.php', ['interface InventoryPostingApplication'], ['$this->']],
        ['src/Inventory/SupplierApplication.php', ['interface SupplierApplication'], ['$this->']],
    ],
];
