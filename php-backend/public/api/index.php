<?php
declare(strict_types=1);

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
if (!is_array($config) || strlen((string)($config['app_key'] ?? '')) < 32) {
    json_response(['ok' => false, 'error' => 'server_not_configured', 'message' => 'کلید امنیتی سرور تنظیم نشده است'], 503);
}

function json_response(array $payload, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function utf8_length(string $value): int {
    $count = preg_match_all('/./us', $value, $matches);
    return $count === false ? strlen($value) : $count;
}

function request_json(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        json_response(['ok' => false, 'error' => 'invalid_json', 'message' => 'درخواست نامعتبر است'], 400);
    }
    if (!is_array($data)) json_response(['ok' => false, 'error' => 'invalid_body', 'message' => 'بدنه درخواست نامعتبر است'], 400);
    return $data;
}

function db(array $config): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $d = $config['db'] ?? [];
    foreach (['host','database','username','password'] as $key) {
        if (!isset($d[$key]) || $d[$key] === '' || str_contains((string)$d[$key], 'YOUR_') || $d[$key] === 'CHANGE_THIS_DATABASE_PASSWORD') {
            json_response(['ok' => false, 'error' => 'database_not_configured', 'message' => 'تنظیم اتصال دیتابیس کامل نیست'], 503);
        }
    }
    $port = (int)($d['port'] ?? 3306);
    $charset = (string)($d['charset'] ?? 'utf8mb4');
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $d['host'], $port, $d['database'], $charset);
    try {
        $pdo = new PDO($dsn, $d['username'], $d['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        return $pdo;
    } catch (Throwable $e) {
        error_log('[3Food POS] Database connection failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'database_unavailable', 'message' => 'اتصال به دیتابیس برقرار نشد'], 503);
    }
}

function same_origin_guard(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return; // Same-origin form clients may omit Origin.
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = strtolower(preg_replace('/:\\d+$/', '', $host) ?? '');
    if (!is_string($originHost) || strtolower($originHost) !== $requestHost) {
        json_response(['ok' => false, 'error' => 'origin_rejected', 'message' => 'مبدأ درخواست معتبر نیست'], 403);
    }
}

function start_secure_session(array $config): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name((string)($config['session']['name'] ?? '3FOODPOSSESSID'));
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $https ? '1' : '0');
    ini_set('session.cookie_samesite', (string)($config['session']['same_site'] ?? 'Strict'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => (string)($config['session']['same_site'] ?? 'Strict'),
    ]);
    session_start();

    $idle = (int)($config['session']['idle_timeout'] ?? 28800);
    if (isset($_SESSION['last_seen']) && time() - (int)$_SESSION['last_seen'] > $idle) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['last_seen'] = time();
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return (string)$_SESSION['csrf'];
}

function require_csrf(): void {
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $saved = $_SESSION['csrf'] ?? '';
    if (!is_string($sent) || !is_string($saved) || $sent === '' || !hash_equals($saved, $sent)) {
        json_response(['ok' => false, 'error' => 'csrf_failed', 'message' => 'نشست امنیتی منقضی شده است؛ صفحه را تازه‌سازی کنید'], 419);
    }
}

function current_user(PDO $pdo): ?array {
    $id = $_SESSION['user_id'] ?? null;
    if (!$id) return null;
    $q = $pdo->prepare('SELECT id, username, display_name, role, is_active, must_change_password FROM app_users WHERE id = ? LIMIT 1');
    $q->execute([(int)$id]);
    $user = $q->fetch();
    if (!$user || !(int)$user['is_active']) {
        $_SESSION = [];
        session_regenerate_id(true);
        return null;
    }
    return $user;
}

function require_user(PDO $pdo): array {
    $user = current_user($pdo);
    if (!$user) json_response(['ok' => false, 'error' => 'unauthorized', 'message' => 'برای ادامه وارد حساب کاربری شوید'], 401);
    return $user;
}

function require_role(PDO $pdo, array $roles): array {
    $user = require_user($pdo);
    if (!in_array($user['role'], $roles, true)) {
        json_response(['ok' => false, 'error' => 'forbidden', 'message' => 'اجازه انجام این عملیات را ندارید'], 403);
    }
    return $user;
}

function audit(PDO $pdo, ?int $actor, string $action, ?string $entityType = null, ?string $entityId = null, array $details = []): void {
    $stmt = $pdo->prepare('INSERT INTO app_audit_logs (actor_user_id, action, entity_type, entity_id, ip_address, details) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $actor,
        $action,
        $entityType,
        $entityId,
        substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
        $details ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
    ]);
}

function client_fingerprint(array $config): array {
    $secret = (string)($config['app_key'] ?? '');
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? 'unknown');
    return [
        hash_hmac('sha256', $ip, $secret),
        hash_hmac('sha256', $ua, $secret),
    ];
}

function login_rate_limited(PDO $pdo, array $config, string $username): bool {
    [$ipKey, $uaKey] = client_fingerprint($config);
    $usernameKey = hash_hmac('sha256', strtolower($username), (string)($config['app_key'] ?? ''));
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM app_login_attempts
         WHERE attempted_at >= (NOW() - INTERVAL 15 MINUTE)
           AND was_successful = 0
           AND (username_key = ? OR ip_key = ?)'
    );
    $stmt->execute([$usernameKey, $ipKey]);
    return (int)$stmt->fetchColumn() >= 8;
}

function record_login_attempt(PDO $pdo, array $config, string $username, bool $success): void {
    [$ipKey] = client_fingerprint($config);
    $pepper = (string)($config['app_key'] ?? '');
    $usernameKey = hash_hmac('sha256', strtolower($username), $pepper);
    $stmt = $pdo->prepare('INSERT INTO app_login_attempts (username_key, ip_key, was_successful) VALUES (?, ?, ?)');
    $stmt->execute([$usernameKey, $ipKey, $success ? 1 : 0]);
    // Keep this operational table bounded.
    $pdo->exec('DELETE FROM app_login_attempts WHERE attempted_at < (NOW() - INTERVAL 30 DAY)');
}

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

if ($method === 'POST' && $path === '/setup/manager') {
    $provided = (string)($_SERVER['HTTP_X_SETUP_TOKEN'] ?? '');
    $expected = (string)($config['setup_token'] ?? '');
    if (strlen($expected) < 32 || str_contains($expected, 'REPLACE_') || !hash_equals($expected, $provided)) {
        json_response(['ok' => false, 'error' => 'setup_token_invalid', 'message' => 'کلید راه‌اندازی معتبر نیست'], 403);
    }
    $body = request_json();
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $display = trim((string)($body['display_name'] ?? 'مدیر'));
    if (!preg_match('/^[a-zA-Z0-9._-]{4,64}$/', $username)) {
        json_response(['ok' => false, 'error' => 'invalid_username', 'message' => 'نام کاربری باید ۴ تا ۶۴ حرف انگلیسی، عدد یا . _ - باشد'], 422);
    }
    if (strlen($password) < 12 || strlen($password) > 200) {
        json_response(['ok' => false, 'error' => 'weak_password', 'message' => 'رمز عبور باید حداقل ۱۲ نویسه باشد'], 422);
    }
    if ($display === '' || utf8_length($display) > 120) {
        json_response(['ok' => false, 'error' => 'invalid_display_name', 'message' => 'نام نمایشی معتبر نیست'], 422);
    }
    try {
        $pdo->beginTransaction();
        $installStmt = $pdo->query('SELECT setup_completed FROM app_install_state WHERE id = 1 FOR UPDATE');
        $install = $installStmt->fetch();
        $existing = (int)$pdo->query('SELECT COUNT(*) FROM app_users')->fetchColumn();
        if (!$install || (int)$install['setup_completed'] === 1 || $existing > 0) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'setup_closed', 'message' => 'راه‌اندازی اولیه قبلاً انجام شده است'], 409);
        }
        $stmt = $pdo->prepare('INSERT INTO app_users (username, password_hash, display_name, role, is_active, must_change_password) VALUES (?, ?, ?, "manager", 1, 0)');
        $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $display]);
        $userId = (int)$pdo->lastInsertId();
        $pdo->exec('UPDATE app_install_state SET setup_completed = 1 WHERE id = 1');
        audit($pdo, $userId, 'initial_manager_created', 'user', (string)$userId);
        $pdo->commit();
        // The setup token must also be removed from private/config.php immediately after this succeeds.
        session_regenerate_id(true);
        $_SESSION = ['user_id' => $userId, 'last_seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
        json_response(['ok' => true, 'user' => ['id' => $userId, 'username' => $username, 'display_name' => $display, 'role' => 'manager'], 'csrf_token' => $_SESSION['csrf']], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[3Food POS] Initial manager setup failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'setup_failed', 'message' => 'ساخت حساب مدیر انجام نشد'], 500);
    }
}

if ($method === 'POST' && $path === '/auth/login') {
    $body = request_json();
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    if ($username === '' || $password === '') json_response(['ok' => false, 'error' => 'credentials_required', 'message' => 'نام کاربری و رمز عبور را وارد کنید'], 422);
    if (login_rate_limited($pdo, $config, $username)) {
        json_response(['ok' => false, 'error' => 'too_many_attempts', 'message' => 'تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه دیگر دوباره امتحان کنید'], 429);
    }
    $stmt = $pdo->prepare('SELECT id, username, password_hash, display_name, role, is_active, must_change_password FROM app_users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    $ok = $row && (int)$row['is_active'] === 1 && password_verify($password, $row['password_hash']);
    record_login_attempt($pdo, $config, $username, (bool)$ok);
    if (!$ok) json_response(['ok' => false, 'error' => 'invalid_credentials', 'message' => 'نام کاربری یا رمز عبور اشتباه است'], 401);

    session_regenerate_id(true);
    $_SESSION = ['user_id' => (int)$row['id'], 'last_seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
    $update = $pdo->prepare('UPDATE app_users SET last_login_at = NOW() WHERE id = ?');
    $update->execute([(int)$row['id']]);
    audit($pdo, (int)$row['id'], 'login', 'user', (string)$row['id']);
    json_response([
        'ok' => true,
        'user' => [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'display_name' => $row['display_name'],
            'role' => $row['role'],
            'must_change_password' => (bool)$row['must_change_password'],
        ],
        'csrf_token' => $_SESSION['csrf'],
    ]);
}

if ($method === 'GET' && $path === '/auth/me') {
    $user = current_user($pdo);
    if (!$user) json_response(['ok' => true, 'authenticated' => false]);
    json_response(['ok' => true, 'authenticated' => true, 'user' => $user, 'csrf_token' => csrf_token()]);
}

if ($method === 'POST' && $path === '/auth/logout') {
    require_csrf();
    $user = current_user($pdo);
    if ($user) audit($pdo, (int)$user['id'], 'logout', 'user', (string)$user['id']);
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'secure' => (bool)$params['secure'],
            'httponly' => true,
            'samesite' => $params['samesite'] ?? 'Strict',
        ]);
    }
    session_destroy();
    json_response(['ok' => true]);
}

if ($method === 'POST' && $path === '/auth/change-password') {
    $user = require_user($pdo);
    require_csrf();
    $body = request_json();
    $current = (string)($body['current_password'] ?? '');
    $next = (string)($body['new_password'] ?? '');
    if (strlen($next) < 12 || strlen($next) > 200) {
        json_response(['ok' => false, 'error' => 'weak_password', 'message' => 'رمز جدید باید حداقل ۱۲ نویسه باشد'], 422);
    }
    $stmt = $pdo->prepare('SELECT password_hash FROM app_users WHERE id = ? LIMIT 1');
    $stmt->execute([(int)$user['id']]);
    $hash = (string)$stmt->fetchColumn();
    if ($current === '' || !password_verify($current, $hash)) {
        json_response(['ok' => false, 'error' => 'current_password_invalid', 'message' => 'رمز فعلی صحیح نیست'], 401);
    }
    $update = $pdo->prepare('UPDATE app_users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
    $update->execute([password_hash($next, PASSWORD_DEFAULT), (int)$user['id']]);
    audit($pdo, (int)$user['id'], 'password_changed', 'user', (string)$user['id']);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['last_seen'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    json_response(['ok' => true, 'csrf_token' => $_SESSION['csrf']]);
}

if ($method === 'GET' && $path === '/users') {
    require_role($pdo, ['manager']);
    $rows = $pdo->query('SELECT id, username, display_name, role, is_active, must_change_password, last_login_at, created_at FROM app_users ORDER BY id ASC')->fetchAll();
    json_response(['ok' => true, 'users' => $rows]);
}

if ($method === 'POST' && $path === '/users') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $body = request_json();
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $display = trim((string)($body['display_name'] ?? ''));
    $role = (string)($body['role'] ?? '');
    if (!preg_match('/^[a-zA-Z0-9._-]{4,64}$/', $username)) json_response(['ok' => false, 'error' => 'invalid_username', 'message' => 'نام کاربری معتبر نیست'], 422);
    if (strlen($password) < 12 || strlen($password) > 200) json_response(['ok' => false, 'error' => 'weak_password', 'message' => 'رمز عبور باید حداقل ۱۲ نویسه باشد'], 422);
    if ($display === '' || utf8_length($display) > 120) json_response(['ok' => false, 'error' => 'invalid_display_name', 'message' => 'نام نمایشی معتبر نیست'], 422);
    if (!in_array($role, ['manager','cashier','kitchen'], true)) json_response(['ok' => false, 'error' => 'invalid_role', 'message' => 'نقش انتخابی معتبر نیست'], 422);
    try {
        $stmt = $pdo->prepare('INSERT INTO app_users (username, password_hash, display_name, role, is_active, must_change_password) VALUES (?, ?, ?, ?, 1, 1)');
        $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $display, $role]);
        $id = (int)$pdo->lastInsertId();
        audit($pdo, (int)$actor['id'], 'user_created', 'user', (string)$id, ['role' => $role]);
        json_response(['ok' => true, 'user' => ['id' => $id, 'username' => $username, 'display_name' => $display, 'role' => $role, 'is_active' => 1]], 201);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') json_response(['ok' => false, 'error' => 'username_exists', 'message' => 'این نام کاربری قبلاً ثبت شده است'], 409);
        error_log('[3Food POS] User creation failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'user_create_failed', 'message' => 'ساخت کاربر انجام نشد'], 500);
    }
}

if (preg_match('#^/users/(\\d+)$#', $path, $match) && $method === 'PATCH') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $targetId = (int)$match[1];
    $body = request_json();
    $allowed = ['display_name', 'role', 'is_active', 'password'];
    $updates = [];
    $values = [];
    if (array_key_exists('display_name', $body)) {
        $v = trim((string)$body['display_name']);
        if ($v === '' || utf8_length($v) > 120) json_response(['ok' => false, 'error' => 'invalid_display_name'], 422);
        $updates[] = 'display_name = ?'; $values[] = $v;
    }
    if (array_key_exists('role', $body)) {
        $v = (string)$body['role'];
        if (!in_array($v, ['manager','cashier','kitchen'], true)) json_response(['ok' => false, 'error' => 'invalid_role'], 422);
        $updates[] = 'role = ?'; $values[] = $v;
    }
    if (array_key_exists('is_active', $body)) {
        if ((int)$targetId === (int)$actor['id'] && !$body['is_active']) json_response(['ok' => false, 'error' => 'cannot_disable_self', 'message' => 'نمی‌توانید حساب خودتان را غیرفعال کنید'], 422);
        $updates[] = 'is_active = ?'; $values[] = !empty($body['is_active']) ? 1 : 0;
    }
    if (array_key_exists('password', $body)) {
        $v = (string)$body['password'];
        if (strlen($v) < 12 || strlen($v) > 200) json_response(['ok' => false, 'error' => 'weak_password'], 422);
        $updates[] = 'password_hash = ?'; $values[] = password_hash($v, PASSWORD_DEFAULT);
        $updates[] = 'must_change_password = 1';
    }
    if (!$updates) json_response(['ok' => false, 'error' => 'no_changes'], 422);

    // Never allow the system to end up without an active manager account.
    $targetStmt = $pdo->prepare('SELECT role, is_active FROM app_users WHERE id = ?');
    $targetStmt->execute([$targetId]);
    $target = $targetStmt->fetch();
    if (!$target) json_response(['ok' => false, 'error' => 'user_not_found'], 404);
    $newRole = array_key_exists('role', $body) ? (string)$body['role'] : (string)$target['role'];
    $newActive = array_key_exists('is_active', $body) ? (!empty($body['is_active']) ? 1 : 0) : (int)$target['is_active'];
    if ($target['role'] === 'manager' && (int)$target['is_active'] === 1 && ($newRole !== 'manager' || $newActive !== 1)) {
        $activeManagers = (int)$pdo->query("SELECT COUNT(*) FROM app_users WHERE role = 'manager' AND is_active = 1")->fetchColumn();
        if ($activeManagers <= 1) json_response(['ok' => false, 'error' => 'last_manager_required', 'message' => 'حداقل یک حساب مدیر فعال باید باقی بماند'], 409);
    }
    $values[] = $targetId;
    $stmt = $pdo->prepare('UPDATE app_users SET ' . implode(', ', $updates) . ' WHERE id = ?');
    $stmt->execute($values);
    if ($stmt->rowCount() < 1) {
        $check = $pdo->prepare('SELECT id FROM app_users WHERE id = ?');
        $check->execute([$targetId]);
        if (!$check->fetch()) json_response(['ok' => false, 'error' => 'user_not_found'], 404);
    }
    audit($pdo, (int)$actor['id'], 'user_updated', 'user', (string)$targetId, ['fields' => array_keys(array_intersect_key($body, array_flip($allowed)))]);
    json_response(['ok' => true]);
}


// Shared POS data: all records are stored centrally in MySQL, never trusted from localStorage.
$resourceRoles = [
    'categories' => ['manager'],
    'products' => ['manager'],
    'ingredients' => ['manager'],
    'customers' => ['manager','cashier'],
    'discounts' => ['manager'],
    'expenses' => ['manager'],
    'templates' => ['manager'],
    'settings' => ['manager'],
    'sms_logs' => ['manager'],
];

if ($method === 'GET' && $path === '/bootstrap') {
    $user = require_user($pdo);
    $resources = $user['role'] === 'kitchen' ? ['categories','products'] : ($user['role'] === 'cashier' ? ['categories','products','customers','discounts','settings'] : ['categories','products','ingredients','customers','discounts','expenses','templates','settings']);
    $result = [];
    foreach ($resources as $resource) {
        $q = $pdo->prepare('SELECT id, payload FROM pos_records WHERE resource = ? ORDER BY created_at ASC');
        $q->execute([$resource]);
        $result[$resource] = array_map(static function(array $row): array {
            $value = json_decode((string)$row['payload'], true);
            return is_array($value) ? $value : [];
        }, $q->fetchAll());
    }
    $orders = $pdo->query('SELECT id, order_number, status, customer_id, customer_name, customer_phone, items, totals, note, created_at, updated_at FROM pos_orders ORDER BY id DESC LIMIT 500')->fetchAll();
    foreach ($orders as &$order) {
        $order['id'] = (string)$order['id'];
        $order['orderNumber'] = (int)$order['order_number'];
        $order['customerId'] = $order['customer_id'];
        $order['customerName'] = $order['customer_name'];
        $order['customerPhone'] = $order['customer_phone'];
        $order['items'] = json_decode((string)$order['items'], true) ?: [];
        $order['totals'] = json_decode((string)$order['totals'], true) ?: [];
        unset($order['order_number'], $order['customer_id'], $order['customer_name'], $order['customer_phone']);
    }
    unset($order);
    $result['orders'] = $orders;
    if ($user['role'] === 'kitchen') {
        $result = ['categories' => $result['categories'] ?? [], 'products' => $result['products'] ?? [], 'orders' => $result['orders']];
    }
    $counter = (int)$pdo->query("SELECT counter_value FROM pos_counters WHERE counter_key = 'order_number'")->fetchColumn();
    json_response(['ok' => true, 'data' => $result, 'next_order' => $counter + 1, 'user' => ['id' => (int)$user['id'], 'username' => $user['username'], 'display_name' => $user['display_name'], 'role' => $user['role']]]);
}

if (preg_match('#^/records/([a-z_]+)$#', $path, $m)) {
    $resource = $m[1];
    if (!isset($resourceRoles[$resource])) json_response(['ok' => false, 'error' => 'resource_not_found'], 404);
    $actor = require_user($pdo);
    if (!in_array($actor['role'], $resourceRoles[$resource], true)) json_response(['ok' => false, 'error' => 'forbidden'], 403);
    if ($method === 'GET') {
        $q = $pdo->prepare('SELECT payload FROM pos_records WHERE resource = ? ORDER BY created_at ASC');
        $q->execute([$resource]);
        $rows = [];
        foreach ($q->fetchAll() as $row) { $v = json_decode((string)$row['payload'], true); if (is_array($v)) $rows[] = $v; }
        json_response(['ok' => true, 'items' => $rows]);
    }
    if ($method === 'POST') {
        require_csrf();
        $body = request_json();
        $item = $body['item'] ?? null;
        if (!is_array($item) || !isset($item['id']) || !is_scalar($item['id'])) json_response(['ok' => false, 'error' => 'invalid_item'], 422);
        $id = substr((string)$item['id'], 0, 100);
        $q = $pdo->prepare('INSERT INTO pos_records (id, resource, payload, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_by = VALUES(updated_by)');
        $q->execute([$id, $resource, json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id']]);
        audit($pdo, (int)$actor['id'], 'record_saved', $resource, $id);
        json_response(['ok' => true, 'item' => $item], 201);
    }
    if ($method === 'DELETE') {
        require_csrf();
        $id = (string)($_GET['id'] ?? '');
        if ($id === '' || strlen($id) > 100) json_response(['ok' => false, 'error' => 'invalid_id'], 422);
        $q = $pdo->prepare('DELETE FROM pos_records WHERE resource = ? AND id = ?');
        $q->execute([$resource, $id]);
        audit($pdo, (int)$actor['id'], 'record_deleted', $resource, $id);
        json_response(['ok' => true]);
    }
}

if ($method === 'POST' && $path === '/orders') {
    $actor = require_role($pdo, ['manager','cashier']);
    require_csrf();
    $body = request_json();
    $items = $body['items'] ?? null;
    $totals = $body['totals'] ?? null;
    if (!is_array($items) || count($items) < 1 || count($items) > 100 || !is_array($totals)) json_response(['ok' => false, 'error' => 'invalid_order', 'message' => 'اقلام یا مبلغ سفارش معتبر نیست'], 422);
    $serverSubtotal = 0;
    $productLookup = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'products' AND id = ? LIMIT 1");
    foreach ($items as $line) {
        if (!is_array($line) || !isset($line['productId'], $line['qty']) || !is_numeric($line['qty']) || (float)$line['qty'] <= 0 || (float)$line['qty'] > 999) json_response(['ok' => false, 'error' => 'invalid_order_item'], 422);
        $productLookup->execute([(string)$line['productId']]);
        $productRaw = $productLookup->fetchColumn();
        $product = is_string($productRaw) ? json_decode($productRaw, true) : null;
        if (!is_array($product) || empty($product['active'])) json_response(['ok' => false, 'error' => 'product_unavailable', 'message' => 'یکی از محصولات سفارش فعال نیست'], 409);
        $unitPrice = (int)($product['price'] ?? -1);
        $validOptions = [];
        foreach (($product['options'] ?? []) as $option) if (is_array($option) && isset($option['id'])) $validOptions[(string)$option['id']] = (int)($option['price'] ?? 0);
        $optionIds = is_array($line['optionIds'] ?? null) ? array_values(array_unique(array_map('strval', $line['optionIds']))) : [];
        foreach ($optionIds as $optionId) {
            if (!array_key_exists($optionId, $validOptions)) json_response(['ok' => false, 'error' => 'invalid_product_option'], 422);
            $unitPrice += $validOptions[$optionId];
        }
        if (isset($line['unitPrice']) && (int)$line['unitPrice'] !== $unitPrice) json_response(['ok' => false, 'error' => 'price_changed', 'message' => 'قیمت محصول تغییر کرده است؛ سبد را تازه‌سازی کنید'], 409);
        $serverSubtotal += $unitPrice * (float)$line['qty'];
    }
    foreach (['subtotal','total'] as $key) {
        if (!isset($totals[$key]) || !is_numeric($totals[$key]) || (float)$totals[$key] < 0 || (float)$totals[$key] > 100000000000) json_response(['ok' => false, 'error' => 'invalid_order_total'], 422);
    }
    if ((int)$totals['subtotal'] !== (int)$serverSubtotal) json_response(['ok' => false, 'error' => 'subtotal_mismatch', 'message' => 'جمع سفارش با قیمت محصولات مطابقت ندارد'], 409);
    try {
        $pdo->beginTransaction();
        $counter = $pdo->query("SELECT counter_value FROM pos_counters WHERE counter_key = 'order_number' FOR UPDATE")->fetchColumn();
        if ($counter === false) throw new RuntimeException('Order counter missing');
        $orderNumber = (int)$counter + 1;
        $pdo->prepare("UPDATE pos_counters SET counter_value = ? WHERE counter_key = 'order_number'")->execute([$orderNumber]);
        $customer = is_array($body['customer'] ?? null) ? $body['customer'] : [];
        $stmt = $pdo->prepare('INSERT INTO pos_orders (order_number, status, customer_id, customer_name, customer_phone, items, totals, note, created_by) VALUES (?, \'new\', ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $orderNumber,
            isset($customer['id']) ? (string)$customer['id'] : null,
            isset($customer['name']) ? substr((string)$customer['name'], 0, 480) : null,
            isset($customer['phone']) ? substr((string)$customer['phone'], 0, 30) : null,
            json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            json_encode($totals, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            isset($body['note']) ? substr((string)$body['note'], 0, 2000) : null,
            (int)$actor['id'],
        ]);
        $id = (int)$pdo->lastInsertId();
        audit($pdo, (int)$actor['id'], 'order_created', 'order', (string)$id, ['order_number' => $orderNumber]);
        $pdo->commit();
        json_response(['ok' => true, 'order' => ['id' => (string)$id, 'orderNumber' => $orderNumber, 'status' => 'new', 'items' => $items, 'totals' => $totals]], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[3Food POS] Order creation failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'order_create_failed', 'message' => 'ثبت سفارش انجام نشد'], 500);
    }
}

if (preg_match('#^/orders/(\d+)/status$#', $path, $m) && $method === 'PATCH') {
    $actor = require_role($pdo, ['manager','kitchen']);
    require_csrf();
    $id = (int)$m[1];
    $body = request_json();
    $status = (string)($body['status'] ?? '');
    if (!in_array($status, ['new','preparing','ready','delivered','cancelled'], true)) json_response(['ok' => false, 'error' => 'invalid_status'], 422);
    $q = $pdo->prepare('UPDATE pos_orders SET status = ? WHERE id = ?');
    $q->execute([$status, $id]);
    if ($q->rowCount() === 0) {
        $exists = $pdo->prepare('SELECT id FROM pos_orders WHERE id = ?'); $exists->execute([$id]);
        if (!$exists->fetch()) json_response(['ok' => false, 'error' => 'order_not_found'], 404);
    }
    audit($pdo, (int)$actor['id'], 'order_status_changed', 'order', (string)$id, ['status' => $status]);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'not_found', 'message' => 'مسیر API پیدا نشد'], 404);
