<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Finance;

/** Persistence port owned by the Finance module. */
interface CashStore
{
    public function listRegisters(int $businessId, int $branchId): array;

    public function createRegister(int $businessId, int $branchId, string $publicId, string $code, string $name): void;

    public function findRegisterForUpdate(int $businessId, int $branchId, string $publicId): ?array;

    public function hasActiveSession(int $businessId, int $branchId, int $registerId): bool;

    public function createSession(
            int $businessId,
            int $branchId,
            int $registerId,
            string $publicId,
            int $openedBy,
            int $openingAmount,
        ): int;

    public function createMovement(
            int $businessId,
            int $branchId,
            int $sessionId,
            string $publicId,
            string $movementType,
            int $amount,
            ?int $paymentId,
            ?int $refundId,
            ?int $expenseId,
            ?string $reason,
            int $actorUserId,
            string $idempotencyHash,
        ): void;

    public function findOpenSessionForUpdate(int $businessId, int $branchId, string $publicId): ?array;

    public function increaseExpectedCash(int $businessId, int $branchId, int $sessionId, int $amount): void;

    public function findSessionForUpdate(int $businessId, int $branchId, string $publicId): ?array;

    public function closeSession(
            int $businessId,
            int $branchId,
            int $sessionId,
            int $countedAmount,
            int $difference,
        ): string;

    public function reviewSession(int $businessId, int $branchId, int $sessionId, int $reviewedBy): void;
}
