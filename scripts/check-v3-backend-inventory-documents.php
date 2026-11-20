<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$read = static function (string $path) use ($root): string {
    $content = file_get_contents($root . '/' . $path);
    if (!is_string($content)) throw new RuntimeException('Unable to read ' . $path);
    return $content;
};
$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

$repository = $read('v3/backend/src/Infrastructure/Database/InventoryDocumentRepository.php');
$service = $read('v3/backend/src/Inventory/InventoryDocumentService.php');
$controller = $read('v3/backend/src/Inventory/InventoryController.php');
$frontController = $read('v3/backend/public/index.php');

$assert(str_contains($repository, 'WHERE business_id = :business_id AND branch_id = :branch_id'), 'Document lookup must enforce business and branch scope.');
$assert(str_contains($repository, 'WHERE d.business_id = :business_id AND d.branch_id = :branch_id'), 'Document list/detail must enforce business and branch scope.');
$assert(str_contains($repository, 'FOR UPDATE'), 'Document numbering must lock the branch sequence row.');
$assert(str_contains($repository, 'findDraftForUpdate'), 'Draft line writes must lock the scoped document row.');
$assert(str_contains($repository, 'conversion_factor_snapshot'), 'Document lines must persist a conversion factor snapshot.');
$assert(str_contains($repository, 'base_quantity'), 'Document lines must persist converted base quantity.');
$assert(str_contains($repository, "INSERT INTO pos_stock_documents"), 'Draft creation must persist a stock document header.');
$assert(str_contains($repository, "'draft'"), 'New stock documents must be created as drafts.');
$assert(str_contains($service, "inventory.stock-document.create"), 'Draft creation must use a dedicated idempotency scope.');
$assert(str_contains($service, 'public function addLine'), 'Draft document line creation must be implemented.');
$assert(str_contains($service, "inventory.stock-document.line.create"), 'Line creation must use a dedicated idempotency scope.');
$assert(str_contains($service, '$this->audit->record('), 'Draft creation must append an audit record.');
$assert(str_contains($service, "'transfer'"), 'Transfer documents must be supported.');
$assert(str_contains($service, "'purchase_receipt'"), 'Purchase receipt documents must be supported.');
$assert(str_contains($service, 'destination_location_id'), 'Transfer destination must be validated.');
$assert(str_contains($service, 'findSupplierId'), 'Supplier references must be resolved in business scope.');
$assert(!preg_match('/(?:UPDATE|INSERT INTO)\s+pos_stock_balances/i', $repository), 'Draft document operations must not mutate stock balances.');
$assert(!preg_match('/INSERT INTO\s+pos_stock_ledger/i', $repository), 'Draft document operations must not append stock ledger entries.');
$assert(str_contains($frontController, "'/api/v1/inventory/documents'"), 'Document routes must be registered.');
$assert(str_contains($controller, 'public function createDocument'), 'Document create handler must be present.');
$assert(str_contains($controller, 'public function createDocumentLine'), 'Document line handler must be present.');
$assert(str_contains($frontController, '/api/v1/inventory/documents/{documentPublicId}/lines'), 'Document line route must be registered.');

echo "V3 inventory draft document contract checks passed.\n";
