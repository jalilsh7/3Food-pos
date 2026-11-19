<?php
declare(strict_types=1);

use PersiaCoder\PosV3\Http\Kernel;
use PersiaCoder\PosV3\Http\Request;
use PersiaCoder\PosV3\Http\Response;
use PersiaCoder\PosV3\Http\Router;

try {
    require dirname(__DIR__) . '/bootstrap.php';

    $router = new Router();
    $router->add('GET', '/api/v1/health', static fn (Request $request): Response =>
        Response::success(['status' => 'ok'])
    );

    (new Kernel($router))->handle(Request::fromGlobals())->send();
} catch (Throwable $exception) {
    error_log('POS_V3 bootstrap_failure=' . $exception::class);
    Response::error([
        'code' => 'service_unavailable',
        'message' => 'The service is temporarily unavailable.',
    ], 503)->send();
}
