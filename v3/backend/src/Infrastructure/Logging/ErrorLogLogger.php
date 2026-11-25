<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Logging;

use PersiaCoder\PosV3\Support\Logger;

final readonly class ErrorLogLogger implements Logger
{
    /** @param list<string>|null $enabledModules */
    public function __construct(private ?array $enabledModules = null) {}

    public static function fromEnvironment(): self
    {
        $configured = getenv('POS_V3_LOG_MODULES');
        if (!is_string($configured) || trim($configured) === '') {
            return new self();
        }

        $modules = [];
        foreach (explode(',', $configured) as $module) {
            $module = strtolower(trim($module));
            if (preg_match('/^[a-z][a-z0-9_-]{0,39}$/', $module)) {
                $modules[] = $module;
            }
        }

        return new self(array_values(array_unique($modules)));
    }

    public function log(
        string $level,
        string $event,
        string $module,
        string $requestId,
        array $context = [],
    ): void {
        $level = strtolower($level);
        if (!in_array($level, ['debug', 'info', 'notice', 'warning', 'error', 'critical'], true)) {
            $level = 'error';
        }
        if (!preg_match('/^[a-z][a-z0-9_.-]{1,99}$/', $event)) {
            $event = 'logging.invalid_event';
        }
        if (!preg_match('/^[a-z][a-z0-9_-]{0,39}$/', $module)) {
            $module = 'system';
        }
        if ($this->enabledModules !== null && !in_array($module, $this->enabledModules, true)) {
            return;
        }

        $record = [
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
            'level' => $level,
            'event' => $event,
            'module' => $module,
            'request_id' => preg_match('/^[A-Za-z0-9._-]{8,36}$/', $requestId) ? $requestId : null,
            'context' => self::redact($context),
        ];

        try {
            $line = json_encode($record, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\Throwable) {
            $line = '{"level":"error","event":"logging.encoding_failed","module":"system"}';
        }
        error_log('POS_V3 ' . $line);
    }

    /** @param array<string,mixed> $context @return array<string,mixed> */
    private static function redact(array $context): array
    {
        $safe = [];
        foreach ($context as $key => $value) {
            $normalized = strtolower((string) $key);
            $normalized = str_replace(['_', '-', '.'], '', $normalized);
            if (preg_match('/password|passwd|token|secret|authorization|cookie|apikey|credential|privatekey/', $normalized)) {
                $safe[(string) $key] = '[REDACTED]';
                continue;
            }
            if (is_array($value)) {
                $safe[(string) $key] = self::redact($value);
            } elseif (is_scalar($value) || $value === null) {
                $safe[(string) $key] = $value;
            } else {
                $safe[(string) $key] = '[' . get_debug_type($value) . ']';
            }
        }
        return $safe;
    }
}
