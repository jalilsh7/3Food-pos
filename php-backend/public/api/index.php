<?php
declare(strict_types=1);

date_default_timezone_set('UTC');

/**
 * 3Food POS - PHP API foundation
 * Phase 1: database connectivity, first-manager setup, sessions and RBAC.
 * All business/POS endpoints are added in later migration phases.
 */

$configPath = dirname(__DIR__, 2) . '/private/config.php';
if (!is_file($configPath)) {
    json_response(['ok' => false, 'error' => 'server_not_configured', 'message' => 'تنظیمات سرور انجام نشده است'], 503);
}
$config = require $configPath;
require_once dirname(__DIR__, 2) . '/private/birthday-sms.php';
require_once dirname(__DIR__, 2) . '/private/birthday-sms-inbox.php';
if (!is_array($config) || strlen((string)($config['app_key'] ?? '')) < 32) {
    json_response(['ok' => false, 'error' => 'server_not_configured', 'message' => 'کلید امنیتی سرور تنظیم نشده است'], 503);
}

require_once dirname(__DIR__, 2) . '/private/api-bootstrap.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^.*?/api(?:/v1)?#', '', $path) ?: '/';
$path = '/' . trim($path, '/');

if (!in_array($method, ['GET','POST','PATCH','DELETE'], true)) {
    header('Allow: GET, POST, PATCH, DELETE');
    json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if (in_array($method, ['POST','PATCH','DELETE'], true)) same_origin_guard();
$pdo = db($config);
start_secure_session($config);

if ($method === 'GET' && $path === '/health') {
    $pdo->query('SELECT 1');
    json_response(['ok' => true, 'service' => '3food-pos-php-api', 'database' => 'mysql']);
}


/* Network payment terminal management and local-agent queue. */
require_once dirname(__DIR__, 2) . '/private/routes/terminals.php';
if ($method === 'GET' && $path === '/preflight') {
    $requiredTables = [
        'app_users', 'app_login_attempts', 'app_audit_logs', 'app_install_state', 'app_appearance_settings',
        'pos_records', 'pos_counters', 'pos_orders', 'pos_order_effects',
        'pos_discount_redemptions', 'app_terminal_agents', 'pos_payment_terminals', 'pos_terminal_payments',
    ];
    $tableStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND ENGINE = "InnoDB"'
    );
    $missingTables = [];
    foreach ($requiredTables as $table) {
        $tableStmt->execute([$table]);
        if ((int)$tableStmt->fetchColumn() !== 1) $missingTables[] = $table;
    }
    $checks = [
        'php_version' => version_compare(PHP_VERSION, '8.1.0', '>='),
        'pdo_mysql' => extension_loaded('pdo_mysql'),
        'json' => extension_loaded('json'),
        'database_connection' => true,
        'innodb_schema' => count($missingTables) === 0,
        'https' => request_is_https(),
    ];
    $setupRequired = null;
    if ($checks['innodb_schema']) {
        $setupCompleted = (int)$pdo->query('SELECT setup_completed FROM app_install_state WHERE id = 1')->fetchColumn() === 1;
        $usersCount = (int)$pdo->query('SELECT COUNT(*) FROM app_users')->fetchColumn();
        $setupRequired = !$setupCompleted && $usersCount === 0;
    }
    $coreReady = $checks['php_version'] && $checks['pdo_mysql'] && $checks['json']
        && $checks['database_connection'] && $checks['innodb_schema'];
    json_response([
        'ok' => true,
        'service' => '3food-pos-php-api',
        'php_version' => PHP_VERSION,
        'checks' => $checks,
        'missing_innodb_tables' => $missingTables,
        'setup_required' => $setupRequired,
        'production_ready' => $coreReady && $checks['https'],
    ]);
}

require_once dirname(__DIR__, 2) . '/private/routes/appearance.php';
require_once dirname(__DIR__, 2) . '/private/routes/auth-users.php';
require_once dirname(__DIR__, 2) . '/private/routes/inventory-backup.php';
require_once dirname(__DIR__, 2) . '/private/routes/records-bootstrap.php';
require_once dirname(__DIR__, 2) . '/private/routes/orders.php';
require_once dirname(__DIR__, 2) . '/private/routes/reports-sms.php';
json_response(['ok' => false, 'error' => 'not_found', 'message' => 'مسیر API پیدا نشد'], 404);
