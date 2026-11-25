<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Persistence port for append-only security audit records. */
interface AuditLogWriter
{
    public function append(
        ?int $actorUserId,
        string $action,
        ?string $entityType,
        ?string $entityId,
        ?string $beforeJson,
        ?string $afterJson,
        ?string $reason,
        ?string $requestId,
        ?string $ipAddress,
        ?int $businessId = null,
        ?int $branchId = null,
    ): void;
}
