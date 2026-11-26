<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Executes a callback atomically without exposing the database connection. */
interface TransactionBoundary
{
    /**
     * @template T
     * @param callable(): T $operation
     * @return T
     */
    public function run(callable $operation): mixed;
}
