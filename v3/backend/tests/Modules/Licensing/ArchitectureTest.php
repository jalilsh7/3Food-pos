<?php
declare(strict_types=1);

return [
    'module' => 'Licensing',
    'required' => ['src/Licensing/README.md', 'src/Licensing/LicensingApplication.php', 'src/Licensing/LicenseVerifier.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Licensing/LicensingApplication.php', ['interface LicensingApplication'], ['$this->']],
        ['src/Licensing/LicenseVerifier.php', ['interface LicenseVerifier'], ['$this->']],
    ],
];
