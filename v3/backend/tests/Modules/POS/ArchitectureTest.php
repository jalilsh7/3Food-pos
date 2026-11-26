<?php
declare(strict_types=1);

return [
    'module' => 'POS',
    'required' => ['src/POS/README.md', 'src/POS/PosSalesApplication.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/POS/PosSalesApplication.php', ['interface PosSalesApplication'], ['$this->']],
    ],
];
