<?php
// Route module loaded in the API dispatcher scope to preserve shared request context.
if ($method === 'GET' && $path === '/setup/status') {
    $completed = (int)$pdo->query('SELECT setup_completed FROM app_install_state WHERE id = 1')->fetchColumn() === 1;
    $users = (int)$pdo->query('SELECT COUNT(*) FROM app_users')->fetchColumn();
    json_response(['ok' => true, 'setup_required' => !$completed && $users === 0]);
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
        $_SESSION = ['user_id' => $userId, 'auth_version' => 0, 'last_seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
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
    $stmt = $pdo->prepare('SELECT id, username, password_hash, display_name, role, is_active, must_change_password, session_version FROM app_users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    $ok = $row && (int)$row['is_active'] === 1 && password_verify($password, $row['password_hash']);
    record_login_attempt($pdo, $config, $username, (bool)$ok);
    if (!$ok) json_response(['ok' => false, 'error' => 'invalid_credentials', 'message' => 'نام کاربری یا رمز عبور اشتباه است'], 401);

    session_regenerate_id(true);
    $_SESSION = ['user_id' => (int)$row['id'], 'auth_version' => (int)$row['session_version'], 'last_seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
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
    json_response(['ok' => true, 'authenticated' => true, 'user' => [
        'id' => (int)$user['id'], 'username' => (string)$user['username'],
        'display_name' => (string)$user['display_name'], 'role' => (string)$user['role'],
        'must_change_password' => (bool)$user['must_change_password'],
    ], 'csrf_token' => csrf_token()]);
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
    $update = $pdo->prepare('UPDATE app_users SET password_hash = ?, must_change_password = 0, session_version = session_version + 1 WHERE id = ?');
    $update->execute([password_hash($next, PASSWORD_DEFAULT), (int)$user['id']]);
    audit($pdo, (int)$user['id'], 'password_changed', 'user', (string)$user['id']);
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['auth_version'] = (int)$user['session_version'] + 1;
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

    // Serialize manager-account changes so two concurrent requests cannot remove
    // the last active manager at the same time.
    try {
        $pdo->beginTransaction();
        $pdo->query('SELECT id FROM app_install_state WHERE id = 1 FOR UPDATE');
        $targetStmt = $pdo->prepare('SELECT role, is_active FROM app_users WHERE id = ? FOR UPDATE');
        $targetStmt->execute([$targetId]);
        $target = $targetStmt->fetch();
        if (!$target) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'user_not_found'], 404);
        }
        $newRole = array_key_exists('role', $body) ? (string)$body['role'] : (string)$target['role'];
        $newActive = array_key_exists('is_active', $body) ? (!empty($body['is_active']) ? 1 : 0) : (int)$target['is_active'];
        if ($target['role'] === 'manager' && (int)$target['is_active'] === 1 && ($newRole !== 'manager' || $newActive !== 1)) {
            $activeManagers = (int)$pdo->query("SELECT COUNT(*) FROM app_users WHERE role = 'manager' AND is_active = 1")->fetchColumn();
            if ($activeManagers <= 1) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'last_manager_required', 'message' => 'حداقل یک حساب مدیر فعال باید باقی بماند'], 409);
            }
        }
        if (array_key_exists('role', $body) || array_key_exists('is_active', $body) || array_key_exists('password', $body)) {
            $updates[] = 'session_version = session_version + 1';
        }
        $values[] = $targetId;
        $stmt = $pdo->prepare('UPDATE app_users SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($values);
        audit($pdo, (int)$actor['id'], 'user_updated', 'user', (string)$targetId, ['fields' => array_keys(array_intersect_key($body, array_flip($allowed)))]);
        $pdo->commit();
        json_response(['ok' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[3Food POS] User update failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'user_update_failed', 'message' => 'ویرایش کاربر انجام نشد'], 500);
    }
}


// Shared POS data: all records are stored centrally in MySQL, never trusted from localStorage.
$resourceRoles = [
    'categories' => ['manager'],
    'products' => ['manager'],
    'ingredients' => ['manager'],
    'customers' => ['manager','cashier'],
    'discounts' => ['manager'],
    'expenses' => ['manager'],
    'expense_categories' => ['manager'],
    'suppliers' => ['manager'],
    'supplier_purchases' => ['manager'],
    'templates' => ['manager'],
    'settings' => ['manager'],
    'sms_logs' => ['manager','cashier'],

];

