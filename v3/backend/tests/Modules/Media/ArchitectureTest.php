<?php
declare(strict_types=1);

return [
    'module' => 'Media',
    'required' => ['src/Media/MediaService.php', 'src/Media/MediaApplication.php', 'src/Media/MediaStore.php', 'src/Media/MediaStorage.php', 'src/Infrastructure/Storage/PrivateMediaStorage.php'],
    'services' => ['src/Media/MediaService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http', 'AuditLogService', 'IdempotencyService'],
    'contains' => [],
    'checks' => [
        ['src/Media/MediaService.php', ['implements MediaApplication'], []],
        ['src/Media/MediaController.php', ['MediaApplication $media'], []],
        ['src/Media/MediaApplication.php', ['interface MediaApplication'], ['$this->']],
    ],
];
