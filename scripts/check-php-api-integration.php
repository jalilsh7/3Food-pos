<?php
declare(strict_types=1);

/**
 * Black-box PHP API integration checks against the disposable CI MySQL database.
 * Uses only synthetic records and removes them by dropping the CI database after the job.
 */

$base = rtrim((string)(getenv('POS_TEST_BASE_URL') ?: 'http://127.0.0.1:8088'), '/');
$setupToken = (string)(getenv('POS_TEST_SETUP_TOKEN') ?: 'ci-only-setup-token-'.str_repeat('x', 48));
$cookie = '';
$csrf = '';

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

function api(string $method, string $path, ?array $body = null, array $extraHeaders = []): array {
    global $base, $cookie;
    $headers = ['Accept: application/json'];
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    foreach ($extraHeaders as $header) $headers[] = $header;
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    $options = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body === null ? '' : json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            'ignore_errors' => true,
            'timeout' => 10,
        ],
    ];
    $context = stream_context_create($options);
    $response = file_get_contents($base . $path, false, $context);
    $responseHeaders = $http_response_header ?? [];
    $status = 0;
    foreach ($responseHeaders as $header) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $header, $m)) $status = (int)$m[1];
        if (stripos($header, 'Set-Cookie:') === 0 && preg_match('/^Set-Cookie:\s*([^;]+)/i', $header, $m)) $cookie = $m[1];
    }
    $decoded = is_string($response) ? json_decode($response, true) : null;
    return ['status' => $status, 'json' => is_array($decoded) ? $decoded : [], 'raw' => $response];
}

function csrf_headers(): array {
    global $csrf;
    return ['X-CSRF-Token: ' . $csrf];
}

try {
    $health = api('GET', '/api/v1/health');
    check($health['status'] === 200 && ($health['json']['database'] ?? '') === 'mysql', 'health endpoint');

    $setup = api('POST', '/api/v1/setup/manager', [
        'username' => 'ci_manager',
        'password' => 'CI-Only-Strong-Password-2026!',
        'display_name' => 'CI Manager',
    ], ['X-Setup-Token: ' . $setupToken]);
    check($setup['status'] === 201, 'first manager setup: ' . json_encode($setup['json']));
    $csrf = (string)($setup['json']['csrf_token'] ?? '');
    check(strlen($csrf) >= 32 && $cookie !== '', 'setup session and CSRF token');

    $setupAgain = api('POST', '/api/v1/setup/manager', [
        'username' => 'ci_manager2',
        'password' => 'CI-Only-Strong-Password-2026!',
        'display_name' => 'CI Manager 2',
    ], ['X-Setup-Token: ' . $setupToken]);
    check($setupAgain['status'] === 409, 'one-time setup must close');

    $csrfRejected = api('POST', '/api/v1/records/products', ['item' => ['id' => 'bad']], ['X-CSRF-Token: invalid']);
    check($csrfRejected['status'] === 419, 'write request rejects missing/invalid CSRF');

    $product = [
        'id' => 'ci-product',
        'name' => 'CI Test Product',
        'price' => 1000,
        'active' => true,
        'options' => [],
        'recipe' => [['ingredientId' => 'ci-ingredient', 'qty' => 2]],
    ];
    $ingredient = ['id' => 'ci-ingredient', 'name' => 'CI Test Ingredient', 'stock' => 10];
    $customer = ['id' => 'ci-customer', 'name' => 'CI Customer', 'phone' => '09000000000', 'points' => 0, 'totalSpent' => 0, 'visits' => 0];
    foreach ([['products', $product], ['ingredients', $ingredient], ['customers', $customer]] as [$resource, $item]) {
        $saved = api('POST', '/api/v1/records/' . $resource, ['item' => $item], csrf_headers());
        check($saved['status'] === 201, 'seed ' . $resource . ': ' . json_encode($saved['json']));
    }

    $key = '11111111-1111-4111-8111-111111111111';
    $orderBody = [
        'idempotencyKey' => $key,
        'items' => [['key' => 'ci-line', 'productId' => 'ci-product', 'qty' => 1, 'unitPrice' => 1000, 'optionIds' => []]],
        'customer' => ['id' => 'ci-customer'],
        'totals' => ['subtotal' => 1000, 'tierDiscount' => 0, 'codeDiscount' => 0, 'pointsDiscount' => 0, 'tax' => 0, 'total' => 1000],
        'note' => 'CI integration order',
    ];
    $created = api('POST', '/api/v1/orders', $orderBody, csrf_headers());
    check($created['status'] === 201, 'create order: ' . json_encode($created['json']));
    $orderId = (string)($created['json']['order']['id'] ?? '');
    check($orderId !== '', 'created order id');
    check(($created['json']['order']['items'][0]['name'] ?? '') === 'CI Test Product', 'server canonical product name');

    $replay = api('POST', '/api/v1/orders', $orderBody, csrf_headers());
    check($replay['status'] === 200 && ($replay['json']['replayed'] ?? false) === true, 'idempotent retry returns original order');

    $conflictBody = $orderBody;
    $conflictBody['note'] = 'different payload';
    $conflict = api('POST', '/api/v1/orders', $conflictBody, csrf_headers());
    check($conflict['status'] === 409 && ($conflict['json']['error'] ?? '') === 'idempotency_conflict', 'idempotency key rejects changed payload');

    $tampered = $orderBody;
    $tampered['idempotencyKey'] = '22222222-2222-4222-8222-222222222222';
    $tampered['items'][0]['unitPrice'] = 999;
    $priceRejected = api('POST', '/api/v1/orders', $tampered, csrf_headers());
    check($priceRejected['status'] === 409, 'client cannot override server product price');

    $stockFailure = [
        'idempotencyKey' => '33333333-3333-4333-8333-333333333333',
        'items' => [['key' => 'ci-overstock', 'productId' => 'ci-product', 'qty' => 5, 'unitPrice' => 1000, 'optionIds' => []]],
        'customer' => ['id' => 'ci-customer'],
        'totals' => ['subtotal' => 5000, 'tierDiscount' => 0, 'codeDiscount' => 0, 'pointsDiscount' => 0, 'tax' => 0, 'total' => 5000],
    ];
    $rejectedStock = api('POST', '/api/v1/orders', $stockFailure, csrf_headers());
    check($rejectedStock['status'] === 409 && ($rejectedStock['json']['error'] ?? '') === 'insufficient_stock', 'insufficient stock rejected');

    $pdo = new PDO(
        'mysql:host=' . (getenv('MYSQL_TEST_HOST') ?: '127.0.0.1') . ';port=' . (getenv('MYSQL_TEST_PORT') ?: '3306') . ';dbname=' . (getenv('MYSQL_TEST_DATABASE') ?: 'threefood_test') . ';charset=utf8mb4',
        (string)(getenv('MYSQL_TEST_USERNAME') ?: 'root'),
        (string)(getenv('MYSQL_TEST_PASSWORD') ?: 'root-ci-password'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $getPayload = static function(PDO $pdo, string $resource, string $id): array {
        $q = $pdo->prepare('SELECT payload FROM pos_records WHERE resource = ? AND id = ?');
        $q->execute([$resource, $id]);
        $raw = $q->fetchColumn();
        return is_string($raw) ? (json_decode($raw, true) ?: []) : [];
    };
    $stockAfterOrder = $getPayload($pdo, 'ingredients', 'ci-ingredient');
    $customerAfterOrder = $getPayload($pdo, 'customers', 'ci-customer');
    check((float)($stockAfterOrder['stock'] ?? -1) === 8.0, 'stock deducted exactly once');
    check((int)($customerAfterOrder['visits'] ?? -1) === 1 && (int)($customerAfterOrder['totalSpent'] ?? -1) === 1000, 'customer loyalty effects applied once');

    $cancel = api('PATCH', '/api/v1/orders/' . rawurlencode($orderId) . '/status', ['status' => 'cancelled'], csrf_headers());
    check($cancel['status'] === 200 && ($cancel['json']['status'] ?? '') === 'cancelled', 'cancel order');
    $cancelAgain = api('PATCH', '/api/v1/orders/' . rawurlencode($orderId) . '/status', ['status' => 'cancelled'], csrf_headers());
    check($cancelAgain['status'] === 409, 'duplicate cancellation rejected');
    $stockAfterCancel = $getPayload($pdo, 'ingredients', 'ci-ingredient');
    $customerAfterCancel = $getPayload($pdo, 'customers', 'ci-customer');
    check((float)($stockAfterCancel['stock'] ?? -1) === 10.0, 'stock restored on cancellation');
    check((int)($customerAfterCancel['visits'] ?? -1) === 0 && (int)($customerAfterCancel['totalSpent'] ?? -1) === 0, 'customer effects reversed on cancellation');
    $effects = $pdo->prepare('SELECT COUNT(*) FROM pos_order_effects WHERE order_id = ? AND reversed_at IS NOT NULL');
    $effects->execute([(int)$orderId]);
    check((int)$effects->fetchColumn() === 2, 'effect ledger marked reversed exactly once');

    // Manager-only user administration and role-specific resource permissions.
    $cashierCreated = api('POST', '/api/v1/users', [
        'username' => 'ci_cashier',
        'password' => 'CI-Cashier-Password-2026!',
        'display_name' => 'CI Cashier',
        'role' => 'cashier',
    ], csrf_headers());
    check($cashierCreated['status'] === 201, 'manager creates cashier account');

    $managerUsers = api('GET', '/api/v1/users');
    check($managerUsers['status'] === 200 && count($managerUsers['json']['users'] ?? []) === 2, 'manager can list users');

    $logout = api('POST', '/api/v1/auth/logout', [], csrf_headers());
    check($logout['status'] === 200, 'manager logout');
    $csrf = '';

    $cashierLogin = api('POST', '/api/v1/auth/login', [
        'username' => 'ci_cashier',
        'password' => 'CI-Cashier-Password-2026!',
    ]);
    check($cashierLogin['status'] === 200 && ($cashierLogin['json']['user']['role'] ?? '') === 'cashier', 'cashier login');
    $csrf = (string)($cashierLogin['json']['csrf_token'] ?? '');
    check(strlen($csrf) >= 32, 'cashier receives CSRF token');

    $cashierUsers = api('GET', '/api/v1/users');
    check($cashierUsers['status'] === 403, 'cashier cannot list user accounts');
    $cashierProducts = api('GET', '/api/v1/records/products');
    check($cashierProducts['status'] === 403, 'cashier cannot read manager-only products');
    $cashierCustomers = api('GET', '/api/v1/records/customers');
    check($cashierCustomers['status'] === 200, 'cashier can read customers');
    $cashierCustomerWrite = api('POST', '/api/v1/records/customers', [
        'item' => ['id' => 'ci-customer-updated', 'name' => 'Cashier Added Customer', 'phone' => '09111111111'],
    ], csrf_headers());
    check($cashierCustomerWrite['status'] === 201, 'cashier can add customer');
    $cashierCustomerDelete = api('DELETE', '/api/v1/records/customers?id=ci-customer-updated', null, csrf_headers());
    check($cashierCustomerDelete['status'] === 403, 'cashier cannot delete customer records');

    // Eight failed attempts are allowed; the ninth is throttled for this IP.
    $lastLogin = [];
    for ($attempt = 1; $attempt <= 9; $attempt++) {
        $lastLogin = api('POST', '/api/v1/auth/login', [
            'username' => 'ci_lockout',
            'password' => 'Definitely-Wrong-Password!',
        ]);
        if ($attempt < 9) check($lastLogin['status'] === 401, 'failed login attempt ' . $attempt);
    }
    check($lastLogin['status'] === 429 && ($lastLogin['json']['error'] ?? '') === 'too_many_attempts', 'login rate limit activates after eight failures');

    echo "PASS: PHP API integration (setup, session/CSRF, records, canonical pricing, idempotency, stock, loyalty, cancellation rollback).\n";
} catch (Throwable $e) {
    fwrite(STDERR, "FAIL: " . $e->getMessage() . "\n");
    exit(1);
}
