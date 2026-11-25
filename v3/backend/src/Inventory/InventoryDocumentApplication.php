<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

/** Public application contract for InventoryDocumentService. */
interface InventoryDocumentApplication
{
    public function list(BusinessContext $scope, ?string $type, ?string $status, int $limit): array;

    public function get(BusinessContext $scope, string $publicId): array;

    public function getValuation(BusinessContext $scope, string $publicId): array;

    public function create(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function addLine(
            ActorContext $actor, BusinessContext $scope, string $documentPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    public function updateLine(
            ActorContext $actor, BusinessContext $scope, string $documentPublicId,
            string $linePublicId, array $payload, string $key, string $requestId, string $ip,
        ): array;

    public function deleteLine(
            ActorContext $actor, BusinessContext $scope, string $documentPublicId,
            string $linePublicId, string $key, string $requestId, string $ip,
        ): array;
}
