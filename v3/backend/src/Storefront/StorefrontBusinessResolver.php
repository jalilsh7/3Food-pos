<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Storefront;

use PersiaCoder\PosV3\Security\BusinessContext;

/** Resolves business/branch scope from a trusted storefront key or domain. */
interface StorefrontBusinessResolver
{
    public function resolve(string $storefrontKey, ?string $branchKey = null): BusinessContext;
}
