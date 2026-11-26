<?php
declare(strict_types=1);

return [
    'module' => 'Loyalty',
    'required' => ['src/Loyalty/README.md', 'src/Loyalty/LoyaltyApplication.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Loyalty/LoyaltyApplication.php', ['interface LoyaltyApplication'], ['$this->']],
    ],
];
