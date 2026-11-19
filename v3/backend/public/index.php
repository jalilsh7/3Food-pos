<?php
declare(strict_types=1);

use PersiaCoder\PosV3\Auth\AuthController;
use PersiaCoder\PosV3\Auth\AuthenticationService;
use PersiaCoder\PosV3\Auth\SessionAuthenticator;
use PersiaCoder\PosV3\Auth\SessionMiddleware;
use PersiaCoder\PosV3\Http\Kernel;
use PersiaCoder\PosV3\Http\Request;
use PersiaCoder\PosV3\Http\Response;
use PersiaCoder\PosV3\Http\Router;
use PersiaCoder\PosV3\Infrastructure\Database\PdoConnectionFactory;
use PersiaCoder\PosV3\Infrastructure\Database\SessionRepository;
use PersiaCoder\PosV3\Security\CsrfGuard;
use PersiaCoder\PosV3\Security\CsrfMiddleware;
use PersiaCoder\PosV3\Security\SameOriginGuard;

try {
    $configuration = require dirname(__DIR__) . '/bootstrap.php';

    $connection = null;
    $getConnection = static function () use (&$connection, $configuration): PDO {
        if (!$connection instanceof PDO) {
            $connection = PdoConnectionFactory::connect($configuration);
        }
        return $connection;
    };

    $controller = null;
    $getController = static function () use (&$controller, $getConnection, $configuration): AuthController {
        if (!$controller instanceof AuthController) {
            $secureCookies = !in_array($configuration->environment, ['development', 'test'], true);
            $controller = new AuthController(
                $getConnection(),
                new AuthenticationService($getConnection(), $configuration->applicationKey),
                $secureCookies,
            );
        }
        return $controller;
    };

    $allowInsecureLocalhost = in_array($configuration->environment, ['development', 'test'], true);
    $originGuard = new SameOriginGuard($allowInsecureLocalhost);

    $sessionMiddleware = static function (Request $request, array $parameters, callable $next) use ($getConnection): Response {
        $middleware = new SessionMiddleware(
            new SessionAuthenticator(new SessionRepository($getConnection()))
        );
        return $middleware($request, $parameters, $next);
    };

    $csrfMiddleware = static function (Request $request, array $parameters, callable $next) use ($getConnection): Response {
        $middleware = new CsrfMiddleware(new CsrfGuard());
        return $middleware($request, $parameters, $next);
    };

    $originMiddleware = static function (Request $request, array $parameters, callable $next) use ($originGuard): Response {
        $originGuard->assert($request);
        return $next($request);
    };

    $router = new Router();
    $router->add('GET', '/api/v1/health', static fn (Request $request): Response =>
        Response::success(['status' => 'ok'])
    );

    $router->add('POST', '/api/v1/auth/login',
        static fn (Request $request): Response => $getController()->login($request),
        [$originMiddleware],
    );

    $router->add('GET', '/api/v1/auth/me',
        static fn (Request $request): Response => $getController()->me($request),
        [$sessionMiddleware],
    );

    $router->add('POST', '/api/v1/auth/logout',
        static fn (Request $request): Response => $getController()->logout($request),
        [$sessionMiddleware, $csrfMiddleware, $originMiddleware],
    );

    (new Kernel($router))->handle(Request::fromGlobals())->send();
} catch (Throwable $exception) {
    error_log('POS_V3 bootstrap_failure=' . $exception::class);
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":{"code":"service_unavailable","message":"The service is temporarily unavailable."}}';
}
