<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for InventoryDocumentService. */
interface InventoryDocumentApplication
{
    /** @return list<array<string,mixed>> */
    public function list(BusinessContext $scope, ?string $type, ?string $status, int $limit): array;

    /** @return array<string,mixed> */

    public function get(BusinessContext $scope, string $publicId): array;

    /** @return array<string,mixed> */

    public function getValuation(BusinessContext $scope, string $publicId): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function create(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function addLine(
            ActorContext $actor, BusinessContext $scope, string $documentPublicId,
            array $payload, string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function updateLine(
            ActorContext $actor, BusinessContext $scope, string $documentPublicId,
            string $linePublicId, array $payload, string $key, string $requestId, string $ip,
        ): array;

    /** @return array{status:int,body:array<string,mixed>,replayed:bool} */

    public function deleteLine(
            ActorContext $actor, BusinessContext $scope, string $documentPublicId,
            string $linePublicId, string $key, string $requestId, string $ip,
        ): array;
}
