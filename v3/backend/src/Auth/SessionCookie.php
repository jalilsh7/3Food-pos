<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use DateTimeImmutable;

final class SessionCookie
{
    public static function issue(string $token, DateTimeImmutable $expiresAt, bool $secure = true): string
    {
        $maxAge = max(0, $expiresAt->getTimestamp() - time());
        return self::baseAttributes($secure) . '; Max-Age=' . $maxAge . '; ' .
            self::COOKIE_NAME . '=' . $token;
    }

    public static function clear(bool $secure = true): string
    {
        return self::baseAttributes($secure) . '; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ' .
            self::COOKIE_NAME . '=';
    }

    private const COOKIE_NAME = SessionAuthenticator::COOKIE_NAME;

    private static function baseAttributes(bool $secure): string
    {
        return ($secure ? 'Secure; ' : '') . 'Path=/; HttpOnly; SameSite=Lax';
    }
}
