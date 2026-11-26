<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\CentralAdmin;

use PersiaCoder\PosV3\Security\ActorContext;

/** Central control-plane tenant, plan, license and usage-limit operations. */
interface TenantProvisioningApplication
{
    /** @param array<string,mixed> $payload */
    public function provision(ActorContext $actor, array $payload, string $idempotencyKey, string $requestId): array;

    public function setPlan(ActorContext $actor, string $tenantPublicId, string $planCode, string $idempotencyKey, string $requestId): array;

    /** @param array<string,mixed> $payload */
    public function issueLicense(ActorContext $actor, string $tenantPublicId, array $payload, string $idempotencyKey, string $requestId): array;

    /** @param array<string,int|bool|string> $limits */
    public function updateUsageLimits(ActorContext $actor, string $tenantPublicId, array $limits, string $idempotencyKey, string $requestId): array;
}
