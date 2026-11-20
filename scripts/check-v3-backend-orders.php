<?php
declare(strict_types=1);

$repository = file_get_contents(__DIR__ . '/../v3/backend/src/Infrastructure/Database/OrderRepository.php');
$service = file_get_contents(__DIR__ . '/../v3/backend/src/Orders/OrderService.php');
$controller = file_get_contents(__DIR__ . '/../v3/backend/src/Orders/OrderController.php');
$client = file_get_contents(__DIR__ . '/../v3/frontend/src/shared/api/client.ts');
$workspace = file_get_contents(__DIR__ . '/../v3/frontend/src/features/orders/OrderCenter.tsx');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
};

$assert(str_contains($repository, 'o.business_id = :business_id AND o.branch_id = :branch_id'), 'Order pagination lost business/branch SQL scope.');
$assert(str_contains($repository, 'o.order_number < :before_order_number'), 'Order pagination cursor predicate is missing.');
$assert(str_contains($repository, 'ORDER BY o.order_number DESC LIMIT :fetch_limit'), 'Order pagination must use a stable descending branch sequence.');
$assert(str_contains($repository, '$limit + 1'), 'Order pagination must fetch one extra row to calculate has_more.');
$assert(str_contains($repository, "'has_more' => \$hasMore"), 'Order pagination has_more metadata is missing.');
$assert(str_contains($repository, "'next_cursor' => \$hasMore"), 'Order pagination next cursor metadata is missing.');
$assert(str_contains($service, "'/^[1-9][0-9]{0,18}$/'"), 'Order cursor validation is missing.');
$assert(str_contains($service, 'FILTER_VALIDATE_INT') && str_contains($service, "'min_range' => 1"), 'Order cursor integer overflow validation is missing.');
$assert(str_contains($controller, "query('before')"), 'Order controller does not accept the before cursor.');
$assert(str_contains($repository, 'o.payment_status = :payment_status'), 'Order repository payment filter is missing.');
$assert(str_contains($repository, 'f.method = :fulfillment_method'), 'Order repository fulfillment filter is missing.');
$assert(str_contains($service, 'paymentStatuses()') && str_contains($service, 'fulfillmentMethods()'), 'Order filter allow-lists are missing.');
$assert(str_contains($controller, "query('payment')") && str_contains($controller, "query('fulfillment')"), 'Order controller does not accept payment/fulfillment filters.');
$assert(str_contains($client, 'payment?: string;') && str_contains($client, 'fulfillment?: string;'), 'Frontend order API filter contract is incomplete.');
$assert(str_contains($workspace, 'payment: payment === "all"') && str_contains($workspace, 'fulfillment: fulfillment === "all"'), 'Order center does not send server-side payment/fulfillment filters.');

$assert(str_contains($client, 'before?: string;') && str_contains($client, 'has_more: boolean;'), 'Frontend order page contract is incomplete.');
$assert(str_contains($workspace, 'loadMoreOrders') && str_contains($workspace, 'نمایش سفارش‌های قدیمی‌تر'), 'Order center does not expose the next page action.');

fwrite(STDOUT, "V3 order cursor pagination contract checks passed.\n");
