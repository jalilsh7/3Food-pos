<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Public application contract for AuthenticationService. */
interface AuthenticationApplication
{
    public function login(string $username, string $password, string $ipAddress, string $userAgent, string $requestId): AuthenticatedSession;

    public function changePassword(int $userId, string $currentPassword, string $newPassword, string $requestId, string $ipAddress): void;
}
