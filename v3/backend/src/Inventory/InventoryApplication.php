<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Inventory;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Public application contract for InventoryService. */
interface InventoryApplication
{
    public function listUnits(): array;

    public function listStockItems(BusinessContext $scope, ?string $search, int $limit): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createStockItem(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function updateStockItem(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    public function listLocations(BusinessContext $scope): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createLocation(
            ActorContext $actor, BusinessContext $scope, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function updateLocation(
            ActorContext $actor, BusinessContext $scope, string $publicId, array $payload,
            string $key, string $requestId, string $ip,
        ): array;

    /** @return list<array<string,mixed>> */
    public function listBalances(
            BusinessContext $scope, ?string $stockItemPublicId, ?string $locationPublicId, int $limit,
        ): array;

    /** @return array{items:list<array<string,mixed>>,next_cursor:?string} */
    public function listLedger(
            BusinessContext $scope, ?string $stockItemPublicId, ?string $locationPublicId,
            ?int $beforeId, int $limit,
        ): array;
}
