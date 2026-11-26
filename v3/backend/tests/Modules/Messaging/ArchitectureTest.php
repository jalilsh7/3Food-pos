<?php
declare(strict_types=1);

return [
    'module' => 'Messaging',
    'required' => ['src/Messaging/README.md', 'src/Messaging/MessagingApplication.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Messaging/MessagingApplication.php', ['interface MessagingApplication'], ['$this->']],
    ],
];
