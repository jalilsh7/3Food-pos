<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Authenticated application actor; transport/session details stay in the Auth adapter. */
final readonly class ActorContext
{
    public function __construct(
        public int $userId,
        public ?string $publicId = null,
    ) {
        if ($this->userId < 1) {
            throw new \InvalidArgumentException('Actor user ID must be positive.');
        }
    }
}
