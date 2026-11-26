<?php
declare(strict_types=1);

return [
    'module' => 'Updates',
    'required' => ['src/Updates/README.md', 'src/Updates/UpdatesApplication.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Updates/UpdatesApplication.php', ['interface UpdatesApplication'], ['$this->']],
    ],
];
