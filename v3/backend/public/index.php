<?php
declare(strict_types=1);

use Closure;
use PersiaCoder\PosV3\Auth\AuthController;
use PersiaCoder\PosV3\Auth\BusinessSetupController;
use PersiaCoder\PosV3\Auth\BranchManagementController;
use PersiaCoder\PosV3\Auth\BranchManagementService;
use PersiaCoder\PosV3\Auth\BusinessSetupService;
use PersiaCoder\PosV3\Auth\BusinessScopeResolver;
use PersiaCoder\PosV3\Auth\PermissionService;
use PersiaCoder\PosV3\Auth\RoleManagementController;
use PersiaCoder\PosV3\Auth\RoleManagementService;
use PersiaCoder\PosV3\Auth\UserManagementController;
use PersiaCoder\PosV3\Auth\UserManagementService;
use PersiaCoder\PosV3\Auth\AuthenticationService;
use PersiaCoder\PosV3\Auth\SessionAuthenticator;
use PersiaCoder\PosV3\Auth\SessionMiddleware;
use PersiaCoder\PosV3\Http\Kernel;
use PersiaCoder\PosV3\Http\Request;
use PersiaCoder\PosV3\Http\Response;
use PersiaCoder\PosV3\Http\Router;
use PersiaCoder\PosV3\Infrastructure\Database\BusinessRepository;
use PersiaCoder\PosV3\Infrastructure\Database\PdoConnectionFactory;
use PersiaCoder\PosV3\Infrastructure\Database\PermissionRepository;
use PersiaCoder\PosV3\Infrastructure\Database\RoleRepository;
use PersiaCoder\PosV3\Infrastructure\Database\SessionRepository;
use PersiaCoder\PosV3\Security\CsrfGuard;
use PersiaCoder\PosV3\Security\CsrfMiddleware;
use PersiaCoder\PosV3\Security\SameOriginGuard;
use PersiaCoder\PosV3\Security\InstallationOwnerMiddleware;
use PersiaCoder\PosV3\Security\PermissionMiddleware;

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

    $setupController = null;
    $getSetupController = static function () use (&$setupController, $getConnection): BusinessSetupController {
        if (!$setupController instanceof BusinessSetupController) {
            $setupController = new BusinessSetupController(new BusinessSetupService($getConnection()));
        }
        return $setupController;
    };

    $roleController = null;
    $getRoleController = static function () use (&$roleController, $getConnection): RoleManagementController {
        if (!$roleController instanceof RoleManagementController) {
            $repository = new PermissionRepository($getConnection());
            $roleController = new RoleManagementController(
                new RoleManagementService(
                    $getConnection(),
                    new RoleRepository($getConnection()),
                    new PermissionService($repository),
                ),
            );
        }
        return $roleController;
    };

    $branchController = null;
    $getBranchController = static function () use (&$branchController, $getConnection): BranchManagementController {
        if (!$branchController instanceof BranchManagementController) {
            $branchController = new BranchManagementController(
                new BranchManagementService(new BusinessRepository($getConnection())),
            );
        }
        return $branchController;
    };

    $userController = null;
    $getUserController = static function () use (&$userController, $getConnection): UserManagementController {
        if (!$userController instanceof UserManagementController) {
            $repository = new PermissionRepository($getConnection());
            $userController = new UserManagementController(
                new UserManagementService(
                    $getConnection(),
                    new PermissionService($repository),
                ),
            );
        }
        return $userController;
    };

    $makePermissionMiddleware = static function (string $permissionCode, bool $requireBranch) use ($getConnection): Closure {
        return static function (Request $request, array $parameters, callable $next) use ($getConnection, $permissionCode, $requireBranch): Response {
            $repository = new PermissionRepository($getConnection());
            $middleware = new PermissionMiddleware(
                new PermissionService($repository),
                new BusinessScopeResolver($repository),
                $permissionCode,
                $requireBranch,
            );
            return $middleware($request, $parameters, $next);
        };
    };

    $ownerMiddleware = static function (Request $request, array $parameters, callable $next) use ($getConnection): Response {
        $middleware = new InstallationOwnerMiddleware(new BusinessRepository($getConnection()));
        return $middleware($request, $parameters, $next);
    };

    $router = new Router();
    $router->add('GET', '/api/v1/health', static fn (Request $request): Response =>
        Response::success(['status' => 'ok'])
    );

    $router->add('POST', '/api/v1/setup/business',
        static fn (Request $request): Response => $getSetupController()->create($request),
        [$sessionMiddleware, $csrfMiddleware, $originMiddleware, $ownerMiddleware],
    );

    $router->add('POST', '/api/v1/auth/login',
        static fn (Request $request): Response => $getController()->login($request),
        [$originMiddleware],
    );

    $router->add('GET', '/api/v1/auth/me',
        static fn (Request $request): Response => $getController()->me($request),
        [$sessionMiddleware],
    );

    $router->add('POST', '/api/v1/auth/change-password',
        static fn (Request $request): Response => $getController()->changePassword($request),
        [$sessionMiddleware, $csrfMiddleware, $originMiddleware],
    );

    $router->add('GET', '/api/v1/access/branches',
        static fn (Request $request): Response => $getBranchController()->list($request),
        [$sessionMiddleware, $makePermissionMiddleware('branches.read', false)],
    );

    $router->add('POST', '/api/v1/access/branches',
        static fn (Request $request): Response => $getBranchController()->create($request),
        [$sessionMiddleware, $makePermissionMiddleware('branches.manage', false), $csrfMiddleware, $originMiddleware],
    );

    $router->add('GET', '/api/v1/access/users',
        static fn (Request $request): Response => $getUserController()->listBusinessUsers($request),
        [$sessionMiddleware, $makePermissionMiddleware('users.read', false)],
    );

    $router->add('GET', '/api/v1/access/branches/users',
        static fn (Request $request): Response => $getUserController()->listBranchUsers($request),
        [$sessionMiddleware, $makePermissionMiddleware('users.read', true)],
    );

    $router->add('POST', '/api/v1/access/users',
        static fn (Request $request): Response => $getUserController()->createBusinessUser($request),
        [$sessionMiddleware, $makePermissionMiddleware('users.manage', false), $csrfMiddleware, $originMiddleware],
    );

    $router->add('POST', '/api/v1/access/branches/users',
        static fn (Request $request): Response => $getUserController()->createBranchUser($request),
        [$sessionMiddleware, $makePermissionMiddleware('users.manage', true), $csrfMiddleware, $originMiddleware],
    );

    $router->add('GET', '/api/v1/access/permissions',
        static fn (Request $request): Response => $getRoleController()->permissions($request),
        [$sessionMiddleware, $makePermissionMiddleware('roles.read', false)],
    );

    $router->add('POST', '/api/v1/access/roles',
        static fn (Request $request): Response => $getRoleController()->create($request),
        [$sessionMiddleware, $makePermissionMiddleware('roles.manage', false), $csrfMiddleware, $originMiddleware],
    );

    $router->add('PATCH', '/api/v1/access/roles/{roleCode}',
        static fn (Request $request, array $parameters): Response => $getRoleController()->update($request, $parameters),
        [$sessionMiddleware, $makePermissionMiddleware('roles.manage', false), $csrfMiddleware, $originMiddleware],
    );

    $router->add('GET', '/api/v1/access/roles',
        static fn (Request $request): Response => $getRoleController()->list($request),
        [$sessionMiddleware, $makePermissionMiddleware('roles.read', false)],
    );

    $router->add('POST', '/api/v1/access/users/{userPublicId}/business-roles',
        static fn (Request $request, array $parameters): Response => $getRoleController()->assignBusiness($request, $parameters),
        [$sessionMiddleware, $makePermissionMiddleware('roles.manage', false), $csrfMiddleware, $originMiddleware],
    );

    $router->add('DELETE', '/api/v1/access/users/{userPublicId}/business-roles/{roleCode}',
        static fn (Request $request, array $parameters): Response => $getRoleController()->removeBusiness($request, $parameters),
        [$sessionMiddleware, $makePermissionMiddleware('roles.manage', false), $csrfMiddleware, $originMiddleware],
    );

    $router->add('POST', '/api/v1/access/users/{userPublicId}/branch-roles',
        static fn (Request $request, array $parameters): Response => $getRoleController()->assignBranch($request, $parameters),
        [$sessionMiddleware, $makePermissionMiddleware('roles.manage', true), $csrfMiddleware, $originMiddleware],
    );

    $router->add('DELETE', '/api/v1/access/users/{userPublicId}/branch-roles/{roleCode}',
        static fn (Request $request, array $parameters): Response => $getRoleController()->removeBranch($request, $parameters),
        [$sessionMiddleware, $makePermissionMiddleware('roles.manage', true), $csrfMiddleware, $originMiddleware],
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
