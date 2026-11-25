<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Read-only query port for audit history. */
interface AuditLogReader
{
    /** @return list<array<string,mixed>> */
    public function listForBusiness(int $businessId, ?int $branchId, ?int $beforeId, int $limit): array;
}
