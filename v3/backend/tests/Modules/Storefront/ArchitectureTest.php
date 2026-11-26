<?php
declare(strict_types=1);

return [
    'module' => 'Storefront',
    'required' => ['src/Storefront/README.md', 'src/Storefront/PublicStorefrontApplication.php', 'src/Storefront/StorefrontBusinessResolver.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Storefront/PublicStorefrontApplication.php', ['interface PublicStorefrontApplication', 'GuestActorContext'], ['$this->']],
        ['src/Storefront/StorefrontBusinessResolver.php', ['interface StorefrontBusinessResolver', 'BusinessContext'], ['$this->']],
    ],
];
