<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Http;

use PersiaCoder\PosV3\Support\ApplicationException;

final class HttpException extends ApplicationException
{
    /** @param array<string, mixed> $details */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }
}
