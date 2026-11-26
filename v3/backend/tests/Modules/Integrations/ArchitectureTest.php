<?php
declare(strict_types=1);

return [
    'module' => 'Integrations',
    'required' => ['src/Integrations/README.md', 'src/Integrations/IntegrationsApplication.php', 'src/Integrations/IntegrationProvider.php'],
    'services' => [],
    'forbidden' => [],
    'contains' => [],
    'checks' => [
        ['src/Integrations/IntegrationsApplication.php', ['interface IntegrationsApplication'], ['$this->']],
        ['src/Integrations/IntegrationProvider.php', ['interface IntegrationProvider'], ['$this->']],
    ],
];
