<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Reporting;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** Read-only scoped reporting queries. */
interface ReportingApplication
{
    public function salesSummary(ActorContext $actor, BusinessContext $scope, \DateTimeImmutable $from, \DateTimeImmutable $to, ?int $branchId = null): array;

    public function inventoryValuation(ActorContext $actor, BusinessContext $scope, \DateTimeImmutable $asOf, ?int $branchId = null): array;

    public function cashSummary(ActorContext $actor, BusinessContext $scope, \DateTimeImmutable $from, \DateTimeImmutable $to, ?int $branchId = null): array;

    public function topProducts(ActorContext $actor, BusinessContext $scope, \DateTimeImmutable $from, \DateTimeImmutable $to, int $limit = 20): array;
}
