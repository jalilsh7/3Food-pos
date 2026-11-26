<?php
declare(strict_types=1);

return [
    'module' => 'Customers',
    'required' => ['src/Customers/README.md', 'src/Customers/CustomerApplication.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Customers/CustomerApplication.php', ['interface CustomerApplication'], ['$this->']],
    ],
];
