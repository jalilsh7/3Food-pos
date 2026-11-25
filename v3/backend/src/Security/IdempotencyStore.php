<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

/** Persistence port for idempotency records. */
interface IdempotencyStore
{
    /**
     * @return array{id:int,created:bool,request_hash:string,response_status:?int,response_ciphertext:?string,response_nonce:?string,response_tag:?string}
     */
    public function createOrLock(
        int $actorUserId,
        int $businessId,
        ?int $branchId,
        string $scopeHash,
        string $endpointCode,
        string $keyHash,
        string $requestHash,
        string $expiresAt,
    ): array;

    public function complete(int $id, int $status, string $ciphertext, string $nonce, string $tag): void;

    public function deletePending(int $id): void;
}
