<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

use InvalidArgumentException;

/** Public guest identity; deliberately has no internal user ID. */
final readonly class GuestActorContext
{
    public function __construct(
        public string $guestPublicId,
        public ?string $customerPublicId = null,
    ) {
        if (!preg_match('/^[A-Za-z0-9_-]{16,100}$/', $this->guestPublicId)) {
            throw new InvalidArgumentException('Guest public ID is invalid.');
        }
        if ($this->customerPublicId !== null
            && !preg_match('/^[A-Za-z0-9_-]{16,100}$/', $this->customerPublicId)) {
            throw new InvalidArgumentException('Customer public ID is invalid.');
        }
    }
}
