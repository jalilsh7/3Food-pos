<?php
declare(strict_types=1);

return [
    'module' => 'CentralAdmin',
    'required' => ['src/CentralAdmin/README.md', 'src/CentralAdmin/TenantProvisioningApplication.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/CentralAdmin/TenantProvisioningApplication.php', ['interface TenantProvisioningApplication'], ['$this->']],
    ],
];
