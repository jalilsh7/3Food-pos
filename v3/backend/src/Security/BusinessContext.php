<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Resolved business and optional branch scope; never construct from untrusted request IDs. */
final readonly class BusinessContext implements BusinessScopeContext
{
    public function __construct(
        public int $businessId,
        public ?int $branchId,
    ) {
        if ($this->businessId < 1 || ($this->branchId !== null && $this->branchId < 1)) {
            throw new \InvalidArgumentException('Business context IDs must be positive.');
        }
    }

    public function businessId(): int { return $this->businessId; }

    public function branchId(): ?int { return $this->branchId; }
}
