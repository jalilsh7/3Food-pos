<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Support;

/** Central structured logging port with module and request correlation fields. */
interface Logger
{
    /** @param array<string,mixed> $context */
    public function log(
        string $level,
        string $event,
        string $module,
        string $requestId,
        array $context = [],
    ): void;
}
