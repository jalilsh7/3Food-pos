<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

use PersiaCoder\PosV3\Auth\AuthenticatedPrincipal;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Http\Request;

final class CsrfGuard
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function assertValid(Request $request, AuthenticatedPrincipal $principal): void
    {
        if (in_array($request->method, self::SAFE_METHODS, true)) {
            return;
        }

        $token = $request->header('x-csrf-token');
        if ($token === null || !preg_match('/^[A-Za-z0-9_-]{43}$/', $token)) {
            throw new HttpException(403, 'csrf_token_missing', 'A valid CSRF token is required.');
        }

        if (!hash_equals($principal->csrfTokenHash, hash('sha256', $token))) {
            throw new HttpException(403, 'csrf_token_invalid', 'The CSRF token is invalid.');
        }
    }
}
