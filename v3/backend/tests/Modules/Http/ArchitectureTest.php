<?php
declare(strict_types=1);

return [
    'module' => 'Http',
    'required' => ["src/Http/Kernel.php","src/Http/Request.php","src/Http/Response.php"],
    'services' => ["src/Http/Kernel.php"],
    'forbidden' => ["use PDO;","Infrastructure\\\\Database"],
    'contains' => ["Support\\\\Logger","Support\\\\ApplicationException"],
    'checks' => [],
];
