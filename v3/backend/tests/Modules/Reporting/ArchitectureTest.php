<?php
declare(strict_types=1);

return [
    'module' => 'Reporting',
    'required' => ['src/Reporting/README.md', 'src/Reporting/ReportingApplication.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Reporting/ReportingApplication.php', ['interface ReportingApplication'], ['$this->']],
    ],
];
