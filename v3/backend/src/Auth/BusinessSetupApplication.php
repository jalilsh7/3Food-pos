<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

/** Public application contract for BusinessSetupService. */
interface BusinessSetupApplication
{
    /** @return array{business_id:string,business_name:string,branch_id:string,branch_name:string} */
    public function createInitialBusiness(
            int $ownerUserId,
            string $name,
            string $code,
            string $timezone,
            string $currency,
            string $branchName,
            string $branchCode,
            string $requestId,
            string $ipAddress,
        ): array;
}
