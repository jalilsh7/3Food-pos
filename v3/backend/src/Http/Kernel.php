<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Http;

use Throwable;
use PersiaCoder\PosV3\Support\Logger;

final readonly class Kernel
{
    public function __construct(private Router $router, private Logger $logger) {}

    private static function moduleForPath(string $path): string
    {
        $segments = explode('/', trim($path, '/'));
        $resource = $segments[2] ?? 'system';
        return match ($resource) {
            'cash' => 'finance',
            'access', 'auth' => 'auth',
            'dining' => 'dining',
            'orders' => 'orders',
            'catalog' => 'catalog',
            'inventory' => 'inventory',
            'recipes' => 'recipes',
            'media' => 'media',
            default => 'system',
        };
    }

    public function handle(Request $request): Response
    {
        try {
            $response = $this->router->dispatch($request);
        } catch (HttpException $exception) {
            $response = Response::error([
                'code' => $exception->errorCode,
                'message' => $exception->getMessage(),
                'details' => (object) $exception->details,
                'request_id' => $request->requestId,
            ], $exception->status);
        } catch (Throwable $exception) {
            $this->logger->log(
                'error',
                'http.unhandled_exception',
                self::moduleForPath($request->path),
                $request->requestId,
                ['exception_class' => $exception::class],
            );
            $response = Response::error([
                'code' => 'internal_error',
                'message' => 'An unexpected error occurred.',
                'request_id' => $request->requestId,
            ], 500);
        }

        return $response->withHeader('X-Request-ID', $request->requestId);
    }
}
