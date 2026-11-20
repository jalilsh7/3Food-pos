<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class InventoryDocumentRepository
{
    public function __construct(private PDO $connection) {}

    public function findLocationId(int $businessId, int $branchId, string $publicId): ?int
    {
        $s = $this->connection->prepare(
            'SELECT id FROM pos_stock_locations
             WHERE business_id = :business_id AND branch_id = :branch_id
               AND public_id = :public_id AND is_active = 1 LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'branch_id' => $branchId, 'public_id' => $publicId]);
        $id = $s->fetchColumn();
        return $id === false ? null : (int) $id;
    }

    public function findSupplierId(int $businessId, string $publicId): ?int
    {
        $s = $this->connection->prepare(
            'SELECT id FROM pos_suppliers
             WHERE business_id = :business_id AND public_id = :public_id AND is_active = 1 LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'public_id' => $publicId]);
        $id = $s->fetchColumn();
        return $id === false ? null : (int) $id;
    }

    public function nextDocumentNumber(int $businessId, int $branchId): string
    {
        $key = 'stockdoc:' . $businessId . ':' . $branchId;
        $insert = $this->connection->prepare(
            'INSERT IGNORE INTO pos_sequences (sequence_key, current_value) VALUES (:key, 0)'
        );
        $insert->execute(['key' => $key]);
        $select = $this->connection->prepare(
            'SELECT current_value FROM pos_sequences WHERE sequence_key = :key FOR UPDATE'
        );
        $select->execute(['key' => $key]);
        $next = (int) $select->fetchColumn() + 1;
        $update = $this->connection->prepare(
            'UPDATE pos_sequences SET current_value = :value WHERE sequence_key = :key'
        );
        $update->execute(['value' => $next, 'key' => $key]);
        return sprintf('STK-%d-%08d', $branchId, $next);
    }

    public function create(
        int $businessId, int $branchId, string $publicId, string $documentNo,
        string $type, int $locationId, ?int $destinationId, ?int $supplierId,
        ?string $reason, int $actorUserId,
    ): void {
        $s = $this->connection->prepare(
            "INSERT INTO pos_stock_documents
             (business_id, branch_id, public_id, document_no, document_type, location_id,
              destination_location_id, supplier_id, status, reason, actor_user_id)
             VALUES
             (:business_id, :branch_id, :public_id, :document_no, :document_type, :location_id,
              :destination_location_id, :supplier_id, 'draft', :reason, :actor_user_id)"
        );
        $s->execute([
            'business_id' => $businessId, 'branch_id' => $branchId, 'public_id' => $publicId,
            'document_no' => $documentNo, 'document_type' => $type, 'location_id' => $locationId,
            'destination_location_id' => $destinationId, 'supplier_id' => $supplierId,
            'reason' => $reason, 'actor_user_id' => $actorUserId,
        ]);
    }

    public function list(int $businessId, int $branchId, ?string $type, ?string $status, int $limit): array
    {
        $sql = 'SELECT d.public_id, d.document_no, d.document_type, d.status, d.reason,
                       src.public_id AS location_id, src.name AS location_name,
                       dst.public_id AS destination_location_id, dst.name AS destination_location_name,
                       d.created_at, d.posted_at
                FROM pos_stock_documents d
                INNER JOIN pos_stock_locations src
                  ON src.id = d.location_id AND src.business_id = d.business_id AND src.branch_id = d.branch_id
                LEFT JOIN pos_stock_locations dst
                  ON dst.id = d.destination_location_id AND dst.business_id = d.business_id AND dst.branch_id = d.branch_id
                WHERE d.business_id = :business_id AND d.branch_id = :branch_id';
        $params = ['business_id' => $businessId, 'branch_id' => $branchId];
        if ($type !== null) { $sql .= ' AND d.document_type = :type'; $params['type'] = $type; }
        if ($status !== null) { $sql .= ' AND d.status = :status'; $params['status'] = $status; }
        $sql .= ' ORDER BY d.id DESC LIMIT :limit';
        $s = $this->connection->prepare($sql);
        $s->bindValue(':business_id', $businessId, PDO::PARAM_INT);
        $s->bindValue(':branch_id', $branchId, PDO::PARAM_INT);
        if ($type !== null) $s->bindValue(':type', $type, PDO::PARAM_STR);
        if ($status !== null) $s->bindValue(':status', $status, PDO::PARAM_STR);
        $s->bindValue(':limit', $limit, PDO::PARAM_INT);
        $s->execute();
        return array_map(static fn (array $r): array => [
            'id' => (string) $r['public_id'], 'document_no' => (string) $r['document_no'],
            'document_type' => (string) $r['document_type'], 'status' => (string) $r['status'],
            'reason' => $r['reason'] === null ? null : (string) $r['reason'],
            'location' => ['id' => (string) $r['location_id'], 'name' => (string) $r['location_name']],
            'destination' => $r['destination_location_id'] === null ? null : [
                'id' => (string) $r['destination_location_id'], 'name' => (string) $r['destination_location_name'],
            ],
            'created_at' => (string) $r['created_at'],
            'posted_at' => $r['posted_at'] === null ? null : (string) $r['posted_at'],
        ], $s->fetchAll(PDO::FETCH_ASSOC));
    }

    public function find(int $businessId, int $branchId, string $publicId): ?array
    {
        $s = $this->connection->prepare(
            'SELECT d.id, d.public_id, d.document_no, d.document_type, d.status, d.reason,
                    d.supplier_id, d.created_at, d.posted_at,
                    src.public_id AS location_id, src.name AS location_name,
                    dst.public_id AS destination_location_id, dst.name AS destination_location_name
             FROM pos_stock_documents d
             INNER JOIN pos_stock_locations src
               ON src.id = d.location_id AND src.business_id = d.business_id AND src.branch_id = d.branch_id
             LEFT JOIN pos_stock_locations dst
               ON dst.id = d.destination_location_id AND dst.business_id = d.business_id AND dst.branch_id = d.branch_id
             WHERE d.business_id = :business_id AND d.branch_id = :branch_id AND d.public_id = :public_id
             LIMIT 1'
        );
        $s->execute(['business_id' => $businessId, 'branch_id' => $branchId, 'public_id' => $publicId]);
        $r = $s->fetch(PDO::FETCH_ASSOC);
        if (!$r) return null;
        return [
            'id' => (string) $r['public_id'], 'document_no' => (string) $r['document_no'],
            'document_type' => (string) $r['document_type'], 'status' => (string) $r['status'],
            'reason' => $r['reason'] === null ? null : (string) $r['reason'],
            'location' => ['id' => (string) $r['location_id'], 'name' => (string) $r['location_name']],
            'destination' => $r['destination_location_id'] === null ? null : [
                'id' => (string) $r['destination_location_id'], 'name' => (string) $r['destination_location_name'],
            ],
            'lines' => [],
            'created_at' => (string) $r['created_at'],
            'posted_at' => $r['posted_at'] === null ? null : (string) $r['posted_at'],
        ];
    }
}
