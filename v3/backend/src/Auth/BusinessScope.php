<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use PersiaCoder\PosV3\Security\BusinessScopeContext;

final readonly class BusinessScope implements BusinessScopeContext
{
    public function __construct(
        public int $businessId,
        public string $businessPublicId,
        public ?int $branchId,
        public ?string $branchPublicId,
    ) {}

    public function businessId(): int { return $this->businessId; }

    public function branchId(): ?int { return $this->branchId; }
}
