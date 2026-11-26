<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Application port for recording security-relevant domain actions. */
interface AuditRecorder
{
    /** @param array<string,mixed>|null $before @param array<string,mixed>|null $after */
    public function record(
        ?int $actorUserId,
        string $action,
        ?string $entityType,
        ?string $entityId,
        ?array $before,
        ?array $after,
        ?string $reason,
        string $requestId,
        string $ipAddress,
        ?int $businessId = null,
        ?int $branchId = null,
    ): void;
}
