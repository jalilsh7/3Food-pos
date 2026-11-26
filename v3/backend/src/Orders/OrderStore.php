<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Orders;

/**
 * Persistence port consumed by the order application service.
 * Implementations belong to Infrastructure and must enforce business/branch scope.
 */
interface OrderStore
{
    public function findCustomerId(int $businessId, string $publicId): ?int;

    public function findOpenTableSessionId(int $businessId, int $branchId, string $publicId): ?int;

    public function findProductForUpdate(int $businessId, string $publicId): ?array;

    public function listActiveVariantsForUpdate(int $businessId, int $productId): array;

    public function listProductOptionGroupsForUpdate(int $businessId, int $productId): array;

    public function findOptionForUpdate(int $businessId, int $groupId, string $publicId): ?array;

    public function nextOrderNumber(int $businessId, int $branchId): int;

    public function createOrder(
            int $businessId,
            int $branchId,
            string $publicId,
            int $orderNumber,
            string $sourceChannel,
            ?int $customerId,
            ?int $tableSessionId,
            int $subtotal,
            int $tax,
            int $total,
            int $actorUserId,
        ): int;

    public function createFulfillment(
            int $businessId,
            int $branchId,
            int $orderId,
            string $method,
            ?string $recipientName,
            ?string $recipientPhone,
            ?string $addressJson,
        ): void;

    public function createOrderItem(
            int $businessId,
            int $branchId,
            int $orderId,
            int $productId,
            ?int $variantId,
            string $productName,
            ?string $variantName,
            ?string $sku,
            string $quantity,
            int $unitPrice,
            int $taxRateBps,
            int $taxAmount,
            int $lineTotal,
        ): int;

    public function createOrderItemOption(
            int $businessId,
            int $branchId,
            int $orderItemId,
            int $groupId,
            int $optionId,
            string $groupName,
            string $optionName,
            int $priceDelta,
        ): void;

    public function createStatusEvent(
            int $businessId,
            int $branchId,
            int $orderId,
            ?string $fromStatus,
            string $toStatus,
            ?string $reasonCode,
            ?string $reasonText,
            int $actorUserId,
            string $sourceChannel,
            ?string $idempotencyHash,
        ): void;

    public function findOrder(int $businessId, int $branchId, string $publicId): ?array;

    public function listOrderItemsWithOptions(int $businessId, int $branchId, int $orderId): array;

    public function listStatusEvents(int $businessId, int $branchId, int $orderId): array;

    public function listOrders(
            int $businessId,
            int $branchId,
            ?string $status,
            ?string $channel,
            int $limit,
            ?int $beforeOrderNumber = null,
            ?string $paymentStatus = null,
            ?string $fulfillmentMethod = null,
            ?string $createdFromUtc = null,
            ?string $createdToUtc = null,
        ): array;

    public function findEffectiveTimezone(int $businessId, int $branchId): ?string;

    public function findOrderForUpdate(int $businessId, int $branchId, string $publicId): ?array;

    public function updateOrderStatus(int $businessId, int $branchId, int $orderId, string $status): void;
}
