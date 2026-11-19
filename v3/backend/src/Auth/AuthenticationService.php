<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\SessionRepository;
use PersiaCoder\PosV3\Infrastructure\Database\TransactionManager;
use PersiaCoder\PosV3\Infrastructure\Database\UserRepository;
use PersiaCoder\PosV3\Security\LoginAttemptLimiter;

final readonly class AuthenticationService
{
    private UserRepository $users;
    private SessionRepository $sessions;
    private TransactionManager $transactions;
    private LoginAttemptLimiter $loginLimiter;
    private string $dummyPasswordHash;

    public function __construct(
        PDO $connection,
        string $applicationKey,
        private int $sessionLifetimeSeconds = 28800,
    ) {
        $this->users = new UserRepository($connection);
        $this->sessions = new SessionRepository($connection);
        $this->transactions = new TransactionManager($connection);
        $this->loginLimiter = new LoginAttemptLimiter($connection, $this->transactions, $applicationKey);
        $this->dummyPasswordHash = password_hash('POS_V3_INVALID_LOGIN_DUMMY', PASSWORD_DEFAULT);
    }

    public function login(string $username, string $password, string $ipAddress, string $userAgent): AuthenticatedSession
    {
        $username = trim($username);
        if ($username === '' || strlen($username) > 64 || $password === '' || strlen($password) > 4096) {
            throw new HttpException(422, 'invalid_credentials_format', 'Username or password format is invalid.');
        }
        if ($this->sessionLifetimeSeconds < 300 || $this->sessionLifetimeSeconds > 86400) {
            throw new \LogicException('Session lifetime must be between five minutes and 24 hours.');
        }

        $this->loginLimiter->assertAllowed($username, $ipAddress);
        $user = $this->users->findByUsername($username);
        $hash = is_array($user) ? (string) $user['password_hash'] : $this->dummyPasswordHash;
        $passwordValid = password_verify($password, $hash);

        if (!is_array($user) || (int) $user['is_active'] !== 1 || !$passwordValid) {
            $this->loginLimiter->recordFailure($username, $ipAddress);
            throw new HttpException(401, 'invalid_credentials', 'Username or password is incorrect.');
        }

        $sessionToken = self::randomToken();
        $csrfToken = self::randomToken();
        $tokenHash = hash('sha256', $sessionToken);
        $csrfTokenHash = hash('sha256', $csrfToken);
        $expiresAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
            ->modify('+' . $this->sessionLifetimeSeconds . ' seconds');

        $safeIp = filter_var($ipAddress, FILTER_VALIDATE_IP) ? $ipAddress : null;
        $userAgentHash = $userAgent === '' ? null : hash('sha256', substr($userAgent, 0, 1024));
        $userId = (int) $user['id'];

        $this->transactions->run(function (PDO $connection) use (
            $user,
            $password,
            $userId,
            $tokenHash,
            $csrfTokenHash,
            $expiresAt,
            $safeIp,
            $userAgentHash,
        ): void {
            if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
                $newHash = password_hash($password, PASSWORD_DEFAULT);
                $this->users->updatePasswordHash($userId, $newHash);
            }
            $this->users->touchLastLogin($userId);
            $this->sessions->create(
                $userId,
                (int) $user['session_version'],
                $tokenHash,
                $csrfTokenHash,
                $expiresAt,
                $safeIp,
                $userAgentHash,
            );
        });

        $this->loginLimiter->clear($username, $ipAddress);

        return new AuthenticatedSession(
            $sessionToken,
            $csrfToken,
            $expiresAt,
            (string) $user['public_id'],
            (string) $user['username'],
            (string) $user['display_name'],
            (int) $user['must_change_password'] === 1,
        );
    }

    private static function randomToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }
}
