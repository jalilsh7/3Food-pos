<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Shared contract for a trusted business/branch scope. */
interface BusinessScopeContext
{
    public function businessId(): int;

    public function branchId(): ?int;
}
