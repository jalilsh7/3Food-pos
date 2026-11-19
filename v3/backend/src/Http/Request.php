<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Http;

use JsonException;

final readonly class Request
{
    /** @param array<string, string> $headers */
    public function __construct(
        public string $method,
        public string $path,
        public array $headers,
        public string $body,
        public string $requestId,
        public array $attributes = [],
    ) {}

    public static function fromGlobals(): self
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH);
        if (!is_string($path) || $path === '' || $path[0] !== '/') $path = '/';

        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_') && is_string($value)) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE']) && is_string($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }

        $candidate = $headers['x-request-id'] ?? '';
        $requestId = is_string($candidate) && preg_match('/^[A-Za-z0-9._-]{8,80}$/', $candidate)
            ? $candidate
            : bin2hex(random_bytes(16));

        $body = file_get_contents('php://input');
        return new self($method, $path, $headers, $body === false ? '' : $body, $requestId);
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function attribute(string $name): mixed
    {
        return $this->attributes[$name] ?? null;
    }

    public function withAttribute(string $name, mixed $value): self
    {
        $attributes = $this->attributes;
        $attributes[$name] = $value;
        return new self($this->method, $this->path, $this->headers, $this->body, $this->requestId, $attributes);
    }

    /** @return array<string, mixed> */
    public function json(): array
    {
        if (trim($this->body) === '') return [];
        try {
            $decoded = json_decode($this->body, false, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new HttpException(400, 'invalid_json', 'Request body must contain valid JSON.');
        }
        if (!$decoded instanceof \\stdClass) {
            throw new HttpException(400, 'invalid_json_shape', 'JSON request body must be an object.');
        }
        return get_object_vars($decoded);
    }
}
