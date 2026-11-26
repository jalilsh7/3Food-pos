<?php
declare(strict_types=1);

return [
    'module' => 'Http',
    'required' => ['src/Http/Kernel.php', 'src/Http/Request.php', 'src/Http/Response.php'],
    'services' => ['src/Http/Kernel.php'],
    'forbidden' => ['use PDO;', 'Infrastructure'],
    'contains' => ['Logger', 'ApplicationException'],
    'checks' => [
        ['src/Http/Kernel.php', ['catch (ApplicationException $exception)'], []],
        ['src/Http/HttpException.php', ['extends ApplicationException'], []],
    ],
];
