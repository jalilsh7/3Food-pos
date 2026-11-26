<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Application port for executing an idempotent use case. */
interface IdempotencyExecutor
{
    /**
     * @param callable(): array{status:int,body:array<string,mixed>} $operation
     * @return array{status:int,body:array<string,mixed>,replayed:bool}
     */
    public function execute(
        int $actorUserId,
        BusinessScopeContext $scope,
        string $endpointCode,
        string $idempotencyKey,
        string $requestHash,
        callable $operation,
    ): array;
}
