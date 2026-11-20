<?php
declare(strict_types=1);

use PersiaCoder\PosV3\Auth\AuthController;
use PersiaCoder\PosV3\Auth\BusinessContextController;
use PersiaCoder\PosV3\Auth\BusinessScope;
use PersiaCoder\PosV3\Auth\BusinessSetupController;
use PersiaCoder\PosV3\Auth\BusinessSetupService;
use PersiaCoder\PosV3\Auth\BranchManagementController;
use PersiaCoder\PosV3\Auth\BranchManagementService;
use PersiaCoder\PosV3\Auth\AuthenticationService;
use PersiaCoder\PosV3\Auth\SessionAuthenticator;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Http\Request;
use PersiaCoder\PosV3\Infrastructure\Database\SessionRepository;
use PersiaCoder\PosV3\Infrastructure\Database\BusinessRepository;
use PersiaCoder\PosV3\Security\CsrfGuard;

$root = dirname(__DIR__);
require_once $root . '/database/v3/bin/bootstrap.php';
spl_autoload_register(static function (string $class) use ($root): void {
    $prefix = 'PersiaCoder\\PosV3\\';
    if (!str_starts_with($class, $prefix)) return;
    $file = $root . '/v3/backend/src/' . str_replace('\\', DIRECTORY_SEPARATOR, substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) require $file;
});

$pdo = PosV3DatabaseTools::connect();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};
$uuid = static fn (): string => sprintf(
    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff),
    random_int(0, 0x0fff) | 0x4000, random_int(0, 0x3fff) | 0x8000,
    random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff),
);
$prefix = 'ci-auth-' . bin2hex(random_bytes(5));
$username = $prefix;
$initialPassword = 'CI-Initial-Password-123!';
$newPassword = 'CI-New-Password-456!';

$insert = $pdo->prepare(
    'INSERT INTO app_users (public_id, username, password_hash, display_name, is_active, must_change_password)
     VALUES (:public_id, :username, :password_hash, :display_name, 1, 1)'
);
$insert->execute([
    'public_id' => $uuid(),
    'username' => $username,
    'password_hash' => password_hash($initialPassword, PASSWORD_DEFAULT),
    'display_name' => 'CI Auth User',
]);
$userId = (int) $pdo->lastInsertId();
$ownerRoleId = $pdo->query("SELECT id FROM app_roles WHERE code = 'owner' AND is_active = 1")->fetchColumn();
if ($ownerRoleId === false) throw new RuntimeException('The installation owner role is missing.');
$pdo->prepare('INSERT INTO app_user_roles (user_id, role_id) VALUES (:user_id, :role_id)')
    ->execute(['user_id' => $userId, 'role_id' => (int) $ownerRoleId]);

$appKey = str_repeat('ci-v3-auth-integration-key-', 2);
$authentication = new AuthenticationService($pdo, $appKey);
$controller = new AuthController($pdo, $authentication, true);
$authenticator = new SessionAuthenticator(new SessionRepository($pdo));
$requestId = static fn (): string => bin2hex(random_bytes(16));
$cookieValue = static function (array $headers, string $name): string {
    $cookies = $headers['Set-Cookie'] ?? null;
    foreach (is_array($cookies) ? $cookies : (is_string($cookies) ? [$cookies] : []) as $cookie) {
        if (str_starts_with($cookie, $name . '=')) {
            return explode(';', substr($cookie, strlen($name) + 1), 2)[0];
        }
    }
    throw new RuntimeException("Expected {$name} cookie was not issued.");
};
$makeRequest = static function (string $method, string $path, array $headers = [], string $body = '') use ($requestId): Request {
    return new Request($method, $path, $headers, $body, $requestId(), ['remote_ip' => '127.0.0.1']);
};

$login = $controller->login($makeRequest(
    'POST', '/api/v1/auth/login',
    ['content-type' => 'application/json', 'user-agent' => 'POS-V3-CI'],
    json_encode(['username' => $username, 'password' => $initialPassword], JSON_THROW_ON_ERROR),
));
$assert($login->status === 200, 'Initial owner login failed.');
$loginData = json_decode($login->body, true, 32, JSON_THROW_ON_ERROR)['data'];
$assert($loginData['user']['must_change_password'] === true, 'Initial user must be required to change password.');
$sessionToken = $cookieValue($login->headers, 'pos_v3_session');
$csrfToken = $cookieValue($login->headers, 'pos_v3_csrf');
$assert(hash_equals($csrfToken, $loginData['csrf_token']), 'CSRF body token and cookie do not match.');
$assert(str_contains(implode(';', $login->headers['Set-Cookie']), 'HttpOnly')
    && str_contains(implode(';', $login->headers['Set-Cookie']), 'Secure')
    && str_contains(implode(';', $login->headers['Set-Cookie']), 'SameSite=Lax'),
    'Session cookie security attributes are missing.');

$stored = $pdo->prepare('SELECT token_hash, csrf_token_hash FROM app_user_sessions WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
$stored->execute(['user_id' => $userId]);
$storedSession = $stored->fetch(PDO::FETCH_ASSOC);
$assert(is_array($storedSession), 'Login did not persist a session.');
$assert(hash_equals((string) $storedSession['token_hash'], hash('sha256', $sessionToken)), 'Session token hash is not stored correctly.');
$assert(!hash_equals((string) $storedSession['token_hash'], $sessionToken), 'Raw session token must never be stored.');
$assert(hash_equals((string) $storedSession['csrf_token_hash'], hash('sha256', $csrfToken)), 'CSRF token hash is not stored correctly.');

$cookieHeader = 'pos_v3_session=' . $sessionToken . '; pos_v3_csrf=' . $csrfToken;
$meRequest = $makeRequest('GET', '/api/v1/auth/me', ['cookie' => $cookieHeader]);
$principal = $authenticator->authenticate($meRequest);
$me = $controller->me($meRequest->withAttribute('principal', $principal));
$meData = json_decode($me->body, true, 32, JSON_THROW_ON_ERROR)['data'];
$assert($meData['user']['id'] === $loginData['user']['id'], 'Session introspection returned a different user.');
$assert(hash_equals($csrfToken, $meData['csrf_token']), 'Session introspection changed a valid CSRF token unexpectedly.');

$rotatedRequest = $makeRequest('GET', '/api/v1/auth/me', [
    'cookie' => 'pos_v3_session=' . $sessionToken . '; pos_v3_csrf=' . str_repeat('a', 43),
]);
$rotatedPrincipal = $authenticator->authenticate($rotatedRequest);
$rotated = $controller->me($rotatedRequest->withAttribute('principal', $rotatedPrincipal));
$rotatedToken = $cookieValue($rotated->headers, 'pos_v3_csrf');
$assert(!hash_equals($csrfToken, $rotatedToken), 'Mismatched CSRF cookie was not rotated.');
$csrfPrincipal = $authenticator->authenticate($makeRequest('GET', '/api/v1/auth/me', [
    'cookie' => 'pos_v3_session=' . $sessionToken . '; pos_v3_csrf=' . $rotatedToken,
]));
$csrfGuard = new CsrfGuard();
$mutation = $makeRequest('POST', '/api/v1/auth/change-password', [
    'cookie' => 'pos_v3_session=' . $sessionToken . '; pos_v3_csrf=' . $rotatedToken,
    'x-csrf-token' => $rotatedToken,
    'content-type' => 'application/json',
], json_encode(['current_password' => $initialPassword, 'new_password' => $newPassword], JSON_THROW_ON_ERROR));
$csrfGuard->assertValid($mutation, $csrfPrincipal);
$passwordChanged = $controller->changePassword($mutation->withAttribute('principal', $csrfPrincipal));
$assert($passwordChanged->status === 200, 'Password change did not succeed.');
$assert(str_contains(implode(';', $passwordChanged->headers['Set-Cookie']), 'Max-Age=0'), 'Password change did not clear authentication cookies.');

$activeSessions = $pdo->prepare('SELECT COUNT(*) FROM app_user_sessions s INNER JOIN app_users u ON u.id = s.user_id
     WHERE s.user_id = :user_id AND s.revoked_at IS NULL AND s.session_version = u.session_version');
$activeSessions->execute(['user_id' => $userId]);
$assert((int) $activeSessions->fetchColumn() === 0, 'Password change did not revoke every active session.');
try {
    $authenticator->authenticate($makeRequest('GET', '/api/v1/auth/me', ['cookie' => $cookieHeader]));
    throw new RuntimeException('Old session remained valid after password change.');
} catch (HttpException $error) {
    $assert($error->status === 401, 'Revoked session returned an unexpected status.');
}

$relogin = $controller->login($makeRequest(
    'POST', '/api/v1/auth/login',
    ['content-type' => 'application/json'],
    json_encode(['username' => $username, 'password' => $newPassword], JSON_THROW_ON_ERROR),
));
$reloginData = json_decode($relogin->body, true, 32, JSON_THROW_ON_ERROR)['data'];
$assert($reloginData['user']['must_change_password'] === false, 'Changed password did not clear forced-change flag.');
$newSessionToken = $cookieValue($relogin->headers, 'pos_v3_session');
$newCsrfToken = $cookieValue($relogin->headers, 'pos_v3_csrf');
$newCookieHeader = 'pos_v3_session=' . $newSessionToken . '; pos_v3_csrf=' . $newCsrfToken;
$newRequest = $makeRequest('GET', '/api/v1/auth/me', ['cookie' => $newCookieHeader]);
$newPrincipal = $authenticator->authenticate($newRequest);
$contextController = new BusinessContextController(new BusinessRepository($pdo));
$contextBeforeSetupRequest = $makeRequest('GET', '/api/v1/access/businesses')->withAttribute('principal', $newPrincipal);
$contextBeforeSetup = $contextController->list($contextBeforeSetupRequest);
$contextBeforeData = json_decode($contextBeforeSetup->body, true, 32, JSON_THROW_ON_ERROR)['data'];
$assert($contextBeforeData['businesses'] === [], 'A fresh installation unexpectedly exposed a business.');
$assert($contextBeforeData['can_initialize'] === true, 'Installation owner cannot initialize the first business.');

$setupController = new BusinessSetupController(new BusinessSetupService($pdo));
$setupRequest = $makeRequest(
    'POST', '/api/v1/setup/business',
    [
        'content-type' => 'application/json',
        'cookie' => $newCookieHeader,
        'x-csrf-token' => $newCsrfToken,
    ],
    json_encode([
        'name' => 'CI Authentication Business',
        'code' => $prefix,
        'timezone' => 'Asia/Tehran',
        'currency' => 'IRT',
        'branch_name' => 'شعبه اصلی',
        'branch_code' => 'main',
    ], JSON_THROW_ON_ERROR),
)->withAttribute('principal', $newPrincipal);
$csrfGuard->assertValid($setupRequest, $newPrincipal);
$setup = $setupController->create($setupRequest);
$setupData = json_decode($setup->body, true, 32, JSON_THROW_ON_ERROR)['data'];
$businessPublicId = (string) $setupData['business']['id'];
$branchPublicId = (string) $setupData['branch']['id'];
$businessIdStatement = $pdo->prepare('SELECT id FROM pos_businesses WHERE public_id = :public_id');
$businessIdStatement->execute(['public_id' => $businessPublicId]);
$businessId = (int) $businessIdStatement->fetchColumn();
$branchIdStatement = $pdo->prepare('SELECT id FROM pos_branches WHERE public_id = :public_id');
$branchIdStatement->execute(['public_id' => $branchPublicId]);
$branchId = (int) $branchIdStatement->fetchColumn();

$managerRoleId = $pdo->query("SELECT id FROM app_roles WHERE code = 'manager' AND is_active = 1")->fetchColumn();
if ($managerRoleId === false) throw new RuntimeException('The manager role is missing.');
$pdo->prepare('INSERT INTO app_user_business_roles (user_id, business_id, role_id) VALUES (:user_id, :business_id, :role_id)')
    ->execute(['user_id' => $userId, 'business_id' => $businessId, 'role_id' => (int) $managerRoleId]);
$pdo->prepare('DELETE FROM app_user_roles WHERE user_id = :user_id AND role_id = :role_id')
    ->execute(['user_id' => $userId, 'role_id' => (int) $ownerRoleId]);

$contextAfterSetupRequest = $makeRequest('GET', '/api/v1/access/businesses')->withAttribute('principal', $newPrincipal);
$contextAfterSetup = $contextController->list($contextAfterSetupRequest);
$contextAfterData = json_decode($contextAfterSetup->body, true, 32, JSON_THROW_ON_ERROR)['data'];
$assert(count($contextAfterData['businesses']) === 1, 'Business membership discovery did not return the assigned business.');
$assert($contextAfterData['businesses'][0]['id'] === $businessPublicId, 'Business context discovery returned the wrong business.');
$assert($contextAfterData['can_initialize'] === false, 'A non-owner business manager was incorrectly allowed to initialize setup.');

$branchController = new BranchManagementController(new BranchManagementService($pdo, $appKey));
$branchListRequest = $makeRequest('GET', '/api/v1/access/branches')->withAttribute(
    'business_scope',
    new BusinessScope($businessId, $businessPublicId, null, null),
);
$branchList = $branchController->list($branchListRequest);
$branchListData = json_decode($branchList->body, true, 32, JSON_THROW_ON_ERROR)['data']['branches'];
$assert(count($branchListData) === 1 && $branchListData[0]['id'] === $branchPublicId, 'Business-scoped branch discovery did not return the initial branch.');

$logoutRequest = $makeRequest('POST', '/api/v1/auth/logout', [
    'cookie' => $newCookieHeader,
    'x-csrf-token' => $newCsrfToken,
]);
$csrfGuard->assertValid($logoutRequest, $newPrincipal);
$logout = $controller->logout($logoutRequest->withAttribute('principal', $newPrincipal));
$assert($logout->status === 200, 'Logout failed.');
$assert(str_contains(implode(';', $logout->headers['Set-Cookie']), 'Max-Age=0'), 'Logout did not clear authentication cookies.');
$activeSessions->execute(['user_id' => $userId]);
$assert((int) $activeSessions->fetchColumn() === 0, 'Logout did not revoke the active session.');

echo "V3 authentication/context integration checks passed: login, hashed cookies, session introspection, CSRF rotation, forced password change, session invalidation, logout, first-business setup, business membership discovery and branch discovery.\n";
