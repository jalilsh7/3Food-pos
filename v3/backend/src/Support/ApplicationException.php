<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Support;

use RuntimeException;

/** Transport-neutral application failure mapped to an HTTP response by the Kernel. */
class ApplicationException extends RuntimeException
{
    /** @param array<string,mixed> $details */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }
}
