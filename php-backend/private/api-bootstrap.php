function request_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
}

function json_response(array $payload, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: frame-ancestors 'none'; base-uri 'none'");
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    if (request_is_https()) header('Strict-Transport-Security: max-age=31536000');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function utf8_length(string $value): int {
    $count = preg_match_all('/./us', $value, $matches);
    return $count === false ? strlen($value) : $count;
}

function loyalty_tier(int $points, array $settings): string {
    $silver=max(1,(int)($settings['loyaltySilverPoints']??500));
    $gold=max($silver+1,(int)($settings['loyaltyGoldPoints']??1500));
    $platinum=max($gold+1,(int)($settings['loyaltyPlatinumPoints']??4000));
    if($points >= $platinum)return 'platinum';
    if($points >= $gold)return 'gold';
    if($points >= $silver)return 'silver';
    return 'bronze';
}
function loyalty_discount_rate(int $points, array $settings): int {
    $tier=loyalty_tier($points,$settings);
    $key=['silver'=>'loyaltySilverDiscount','gold'=>'loyaltyGoldDiscount','platinum'=>'loyaltyPlatinumDiscount'][$tier]??null;
    return $key===null?0:max(0,min(100,(int)($settings[$key]??(['silver'=>3,'gold'=>5,'platinum'=>8][$tier]))));
}

function product_unit_cost(PDO $pdo, array $product): int {
    $configured=max(0,(int)($product['cost']??0));
    $recipe=$product['recipe']??[];
    if(!is_array($recipe)||!$recipe)return $configured;
    $stmt=$pdo->prepare("SELECT payload FROM pos_records WHERE resource='ingredients' AND id=? LIMIT 1");
    $total=0.0;
    $lineCount=0;
    foreach($recipe as $line){
        if(!is_array($line))return $configured;
        $id=trim((string)($line['ingredientId']??''));
        $qtyRaw=$line['qty']??null;
        if($id===''||!is_numeric($qtyRaw))return $configured;
        $qty=(float)$qtyRaw;
        if(!is_finite($qty)||$qty<=0||$qty>1000000)return $configured;
        $stmt->execute([$id]);$raw=$stmt->fetchColumn();
        $ingredient=is_string($raw)?json_decode($raw,true):null;
        $unitCostRaw=is_array($ingredient)?($ingredient['costPerUnit']??null):null;
        if(!is_array($ingredient)||!is_numeric($unitCostRaw))return $configured;
        $unitCost=(float)$unitCostRaw;
        if(!is_finite($unitCost)||$unitCost<0)return $configured;
        $total+=$unitCost*$qty;
        $lineCount++;
    }
    // Never understate COGS with a partial recipe: use the configured product cost
    // until every recipe ingredient has a valid current weighted cost.
    return $lineCount>0?(int)round($total):$configured;
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
        // Store database timestamps in UTC; API presentation converts them to Tehran time.
        $pdo->exec("SET time_zone = '+00:00'");
        return $pdo;
    } catch (Throwable $e) {
        error_log('[3Food POS] Database connection failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'database_unavailable', 'message' => 'اتصال به دیتابیس برقرار نشد'], 503);
    }
}

function same_origin_guard(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        if (strtolower((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')) === 'cross-site') {
            json_response(['ok' => false, 'error' => 'origin_rejected', 'message' => 'مبدأ درخواست معتبر نیست'], 403);
        }
        return; // Non-browser same-origin clients may omit Origin.
    }
    $originParts = parse_url($origin);
    if (!is_array($originParts)) {
        json_response(['ok' => false, 'error' => 'origin_rejected', 'message' => 'مبدأ درخواست معتبر نیست'], 403);
    }
    $requestHost = (string)($_SERVER['HTTP_HOST'] ?? '');
    $requestParts = parse_url('//' . $requestHost);
    if (!is_array($requestParts)) {
        json_response(['ok' => false, 'error' => 'origin_rejected', 'message' => 'مبدأ درخواست معتبر نیست'], 403);
    }
    $originScheme = strtolower((string)($originParts['scheme'] ?? ''));
    $requestScheme = request_is_https() ? 'https' : 'http';
    $originHost = strtolower((string)($originParts['host'] ?? ''));
    $requestHostName = strtolower((string)($requestParts['host'] ?? ''));
    $originPort = (int)($originParts['port'] ?? ($originScheme === 'https' ? 443 : 80));
    $requestPort = (int)($requestParts['port'] ?? ($requestScheme === 'https' ? 443 : 80));
    if (!in_array($originScheme, ['http', 'https'], true) ||
        $originHost === '' || $originHost !== $requestHostName ||
        $originScheme !== $requestScheme || $originPort !== $requestPort ||
        isset($originParts['user']) || isset($originParts['pass']) ||
        isset($originParts['path']) && $originParts['path'] !== '' ||
        isset($originParts['query']) || isset($originParts['fragment'])) {
        json_response(['ok' => false, 'error' => 'origin_rejected', 'message' => 'مبدأ درخواست معتبر نیست'], 403);
    }
}

function start_secure_session(array $config): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = request_is_https();
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
    $q = $pdo->prepare('SELECT id, username, display_name, role, is_active, must_change_password, session_version FROM app_users WHERE id = ? LIMIT 1');
    $q->execute([(int)$id]);
    $user = $q->fetch();
    if (!$user || !(int)$user['is_active'] || (int)($user['session_version'] ?? 0) !== (int)($_SESSION['auth_version'] ?? -1)) {
        $_SESSION = [];
        session_regenerate_id(true);
        return null;
    }
    // Normalize MySQL TINYINT values before JSON serialization. Some PDO
    // driver configurations return "0"/"1" strings; JavaScript treats "0"
    // as truthy and would incorrectly force the password-change screen.
    $user['id'] = (int)$user['id'];
    $user['is_active'] = (bool)$user['is_active'];
    $user['must_change_password'] = (bool)$user['must_change_password'];
    $user['session_version'] = (int)$user['session_version'];
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


function require_terminal_agent(PDO $pdo): array {
    $token = (string)($_SERVER['HTTP_X_TERMINAL_AGENT_TOKEN'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/D', $token)) {
        json_response(['ok'=>false,'error'=>'terminal_agent_unauthorized','message'=>'عامل کارتخوان مجاز نیست'],401);
    }
    $stmt=$pdo->prepare('SELECT id,name,enabled FROM app_terminal_agents WHERE token_hash=? LIMIT 1');
    $stmt->execute([hash('sha256',$token)]);
    $agent=$stmt->fetch();
    if(!is_array($agent)||(int)$agent['enabled']!==1) {
        json_response(['ok'=>false,'error'=>'terminal_agent_unauthorized','message'=>'عامل کارتخوان غیرفعال است'],401);
    }
    return $agent;
}


function is_private_terminal_ip(string $ip): bool {
    $packed=@inet_pton($ip);
    if($packed===false)return false;
    if(strlen($packed)===4){
        $a=ord($packed[0]);$b=ord($packed[1]);
        return $a===10||($a===172&&$b>=16&&$b<=31)||($a===192&&$b===168)||($a===169&&$b===254);
    }
    if(strlen($packed)===16){
        $a=ord($packed[0]);$b=ord($packed[1]);
        return (($a&0xfe)===0xfc)||($a===0xfe&&($b&0xc0)===0x80);
    }
    return false;
}

function valid_uuid(string $value): bool {
    return preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iD',$value)===1;
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
