<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Integrations;

use PersiaCoder\PosV3\Security\BusinessContext;

/** Adapter contract implemented by each external integration provider. */
interface IntegrationProvider
{
    public function code(): string;

    /** @return list<string> */
    public function capabilities(): array;

    /** @param array<string,mixed> $options */
    public function syncProducts(BusinessContext $scope, array $options): array;

    /** @param array<string,mixed> $options */
    public function syncOrders(BusinessContext $scope, array $options): array;
}
