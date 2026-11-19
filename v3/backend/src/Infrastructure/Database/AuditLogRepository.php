<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Infrastructure\Database;

use PDO;

final readonly class AuditLogRepository
{
    public function __construct(private PDO $connection) {}

    public function append(
        ?int $actorUserId,
        string $action,
        ?string $entityType,
        ?string $entityId,
        ?string $beforeJson,
        ?string $afterJson,
        ?string $reason,
        ?string $requestId,
        ?string $ipAddress,
    ): void {
        $statement = $this->connection->prepare(
            'INSERT INTO app_audit_logs
                (actor_user_id, action, entity_type, entity_id, before_json, after_json, reason, request_id, ip_address)
             VALUES
                (:actor_user_id, :action, :entity_type, :entity_id, :before_json, :after_json, :reason, :request_id, :ip_address)'
        );
        $statement->execute([
            'actor_user_id' => $actorUserId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'before_json' => $beforeJson,
            'after_json' => $afterJson,
            'reason' => $reason,
            'request_id' => $requestId,
            'ip_address' => $ipAddress,
        ]);
    }
}
