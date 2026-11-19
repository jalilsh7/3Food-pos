<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class OrderRepository
{
    public function __construct(private PDO $connection) {}

    public function findCustomerId(int $businessId, string $publicId): ?int
    {
        $statement = $this->connection->prepare(
            'SELECT id FROM pos_customers
             WHERE business_id = :business_id AND public_id = :public_id AND is_active = 1
             LIMIT 1'
        );
        $statement->execute(['business_id' => $businessId, 'public_id' => $publicId]);
        $value = $statement->fetchColumn();
        return $value === false ? null : (int) $value;
    }

    public function findOpenTableSessionId(int $businessId, int $branchId, string $publicId): ?int
    {
        $statement = $this->connection->prepare(
            "SELECT id FROM pos_table_sessions
             WHERE business_id = :business_id AND branch_id = :branch_id
               AND public_id = :public_id AND status = 'open'
             LIMIT 1 FOR UPDATE"
        );
        $statement->execute([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'public_id' => $publicId,
        ]);
        $value = $statement->fetchColumn();
        return $value === false ? null : (int) $value;
    }

    /** @return array<string,mixed>|null */
    public function findProductForUpdate(int $businessId, string $publicId): ?array
    {
        $statement = $this->connection->prepare(
            'SELECT id, public_id, name, sku, product_type, base_price_amount, tax_rate_bps
             FROM pos_products
             WHERE business_id = :business_id AND public_id = :public_id
               AND is_active = 1 AND archived_at IS NULL
             LIMIT 1 FOR UPDATE'
        );
        $statement->execute(['business_id' => $businessId, 'public_id' => $publicId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /** @return list<array<string,mixed>> */
    public function listActiveVariantsForUpdate(int $businessId, int $productId): array
    {
        $statement = $this->connection->prepare(
            'SELECT id, public_id, name, sku, price_delta_amount
             FROM pos_product_variants
             WHERE business_id = :business_id AND product_id = :product_id AND is_active = 1
             ORDER BY name ASC, id ASC FOR UPDATE'
        );
        $statement->execute(['business_id' => $businessId, 'product_id' => $productId]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /** @return list<array<string,mixed>> */
    public function listProductOptionGroupsForUpdate(int $businessId, int $productId): array
    {
        $statement = $this->connection->prepare(
            'SELECT g.id, g.public_id, g.name, g.selection_type, g.min_select, g.max_select,
                    pog.is_required
             FROM pos_product_option_groups pog
             INNER JOIN pos_option_groups g
               ON g.id = pog.option_group_id AND g.business_id = pog.business_id
             WHERE pog.business_id = :business_id
               AND pog.product_id = :product_id
               AND g.is_active = 1
             ORDER BY pog.sort_order ASC, g.name ASC
             FOR UPDATE'
        );
        $statement->execute(['business_id' => $businessId, 'product_id' => $productId]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /** @return array<string,mixed>|null */
    public function findOptionForUpdate(int $businessId, int $groupId, string $publicId): ?array
    {
        $statement = $this->connection->prepare(
            'SELECT id, public_id, group_id, name, price_delta_amount
             FROM pos_options
             WHERE business_id = :business_id AND group_id = :group_id
               AND public_id = :public_id AND is_active = 1
             LIMIT 1 FOR UPDATE'
        );
        $statement->execute([
            'business_id' => $businessId,
            'group_id' => $groupId,
            'public_id' => $publicId,
        ]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function nextOrderNumber(int $businessId, int $branchId): int
    {
        $sequenceKey = 'order:' . $businessId . ':' . $branchId;
        $insert = $this->connection->prepare(
            'INSERT IGNORE INTO pos_sequences (sequence_key, current_value) VALUES (:sequence_key, 0)'
        );
        $insert->execute(['sequence_key' => $sequenceKey]);

        $update = $this->connection->prepare(
            'UPDATE pos_sequences
             SET current_value = LAST_INSERT_ID(current_value + 1)
             WHERE sequence_key = :sequence_key'
        );
        $update->execute(['sequence_key' => $sequenceKey]);
        return (int) $this->connection->lastInsertId();
    }

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
    ): int {
        $statement = $this->connection->prepare(
            "INSERT INTO pos_orders
                (business_id, branch_id, public_id, order_number, source_channel, order_status,
                 payment_status, customer_id, table_session_id, currency_code, subtotal_amount,
                 discount_amount, tax_amount, delivery_fee_amount, total_amount, created_by)
             VALUES
                (:business_id, :branch_id, :public_id, :order_number, :source_channel, 'draft',
                 'unpaid', :customer_id, :table_session_id, 'IRT', :subtotal_amount,
                 0, :tax_amount, 0, :total_amount, :created_by)"
        );
        $statement->execute([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'public_id' => $publicId,
            'order_number' => $orderNumber,
            'source_channel' => $sourceChannel,
            'customer_id' => $customerId,
            'table_session_id' => $tableSessionId,
            'subtotal_amount' => $subtotal,
            'tax_amount' => $tax,
            'total_amount' => $total,
            'created_by' => $actorUserId,
        ]);
        return (int) $this->connection->lastInsertId();
    }

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
    ): int {
        $statement = $this->connection->prepare(
            'INSERT INTO pos_order_items
                (business_id, branch_id, order_id, product_id, variant_id, product_name_snapshot,
                 variant_name_snapshot, sku_snapshot, quantity, unit_price_amount, discount_amount,
                 tax_rate_bps, tax_amount, line_total_amount)
             VALUES
                (:business_id, :branch_id, :order_id, :product_id, :variant_id, :product_name_snapshot,
                 :variant_name_snapshot, :sku_snapshot, :quantity, :unit_price_amount, 0,
                 :tax_rate_bps, :tax_amount, :line_total_amount)'
        );
        $statement->execute([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'order_id' => $orderId,
            'product_id' => $productId,
            'variant_id' => $variantId,
            'product_name_snapshot' => $productName,
            'variant_name_snapshot' => $variantName,
            'sku_snapshot' => $sku,
            'quantity' => $quantity,
            'unit_price_amount' => $unitPrice,
            'tax_rate_bps' => $taxRateBps,
            'tax_amount' => $taxAmount,
            'line_total_amount' => $lineTotal,
        ]);
        return (int) $this->connection->lastInsertId();
    }

    public function createOrderItemOption(
        int $businessId,
        int $branchId,
        int $orderItemId,
        int $groupId,
        int $optionId,
        string $groupName,
        string $optionName,
        int $priceDelta,
    ): void {
        $statement = $this->connection->prepare(
            'INSERT INTO pos_order_item_options
                (business_id, branch_id, order_item_id, option_group_id, option_id,
                 group_name_snapshot, option_name_snapshot, price_delta_amount, quantity)
             VALUES
                (:business_id, :branch_id, :order_item_id, :option_group_id, :option_id,
                 :group_name_snapshot, :option_name_snapshot, :price_delta_amount, 1)'
        );
        $statement->execute([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'order_item_id' => $orderItemId,
            'option_group_id' => $groupId,
            'option_id' => $optionId,
            'group_name_snapshot' => $groupName,
            'option_name_snapshot' => $optionName,
            'price_delta_amount' => $priceDelta,
        ]);
    }

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
    ): void {
        $statement = $this->connection->prepare(
            'INSERT INTO pos_order_status_events
                (business_id, branch_id, order_id, from_status, to_status, reason_code,
                 reason_text, actor_user_id, source_channel, idempotency_key)
             VALUES
                (:business_id, :branch_id, :order_id, :from_status, :to_status, :reason_code,
                 :reason_text, :actor_user_id, :source_channel, :idempotency_key)'
        );
        $statement->execute([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'order_id' => $orderId,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'reason_code' => $reasonCode,
            'reason_text' => $reasonText,
            'actor_user_id' => $actorUserId,
            'source_channel' => $sourceChannel,
            'idempotency_key' => $idempotencyHash,
        ]);
    }

    /** @return list<array<string,mixed>> */
    public function listOrders(int $businessId, int $branchId, ?string $status, ?string $channel, int $limit): array
    {
        $sql = 'SELECT o.public_id, o.order_number, o.source_channel, o.order_status, o.payment_status,
                       o.subtotal_amount, o.tax_amount, o.total_amount, o.currency_code,
                       o.created_at, c.public_id AS customer_public_id, c.name AS customer_name
                FROM pos_orders o
                LEFT JOIN pos_customers c ON c.id = o.customer_id AND c.business_id = o.business_id
                WHERE o.business_id = :business_id AND o.branch_id = :branch_id';
        $parameters = ['business_id' => $businessId, 'branch_id' => $branchId];
        if ($status !== null) {
            $sql .= ' AND o.order_status = :order_status';
            $parameters['order_status'] = $status;
        }
        if ($channel !== null) {
            $sql .= ' AND o.source_channel = :source_channel';
            $parameters['source_channel'] = $channel;
        }
        $sql .= ' ORDER BY o.id DESC LIMIT :limit';
        $statement = $this->connection->prepare($sql);
        foreach ($parameters as $key => $value) {
            $statement->bindValue(':' . $key, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':business_id', $businessId, PDO::PARAM_INT);
        $statement->bindValue(':branch_id', $branchId, PDO::PARAM_INT);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'order_number' => (int) $row['order_number'],
            'source_channel' => (string) $row['source_channel'],
            'order_status' => (string) $row['order_status'],
            'payment_status' => (string) $row['payment_status'],
            'subtotal_amount' => (int) $row['subtotal_amount'],
            'tax_amount' => (int) $row['tax_amount'],
            'total_amount' => (int) $row['total_amount'],
            'currency_code' => (string) $row['currency_code'],
            'created_at' => (string) $row['created_at'],
            'customer' => $row['customer_public_id'] === null ? null : [
                'id' => (string) $row['customer_public_id'],
                'name' => (string) $row['customer_name'],
            ],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    /** @return array<string,mixed>|null */
    public function findOrderForUpdate(int $businessId, int $branchId, string $publicId): ?array
    {
        $statement = $this->connection->prepare(
            'SELECT id, public_id, order_number, source_channel, order_status, payment_status,
                    total_amount, created_at
             FROM pos_orders
             WHERE business_id = :business_id AND branch_id = :branch_id AND public_id = :public_id
             LIMIT 1 FOR UPDATE'
        );
        $statement->execute([
            'business_id' => $businessId,
            'branch_id' => $branchId,
            'public_id' => $publicId,
        ]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function updateOrderStatus(int $businessId, int $branchId, int $orderId, string $status): void
    {
        $statement = $this->connection->prepare(
            'UPDATE pos_orders
             SET order_status = :order_status,
                 accepted_at = CASE
                     WHEN :accepted_status = 1 THEN COALESCE(accepted_at, UTC_TIMESTAMP(3))
                     ELSE accepted_at
                 END
             WHERE id = :order_id AND business_id = :business_id AND branch_id = :branch_id'
        );
        $statement->execute([
            'order_status' => $status,
            'accepted_status' => $status === 'accepted' ? 1 : 0,
            'order_id' => $orderId,
            'business_id' => $businessId,
            'branch_id' => $branchId,
        ]);
    }
}
