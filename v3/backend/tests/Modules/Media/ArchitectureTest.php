<?php
declare(strict_types=1);

return [
    'module' => 'Media',
    'required' => ['src/Media/MediaService.php', 'src/Media/MediaStore.php', 'src/Media/MediaStorage.php', 'src/Infrastructure/Storage/PrivateMediaStorage.php'],
    'services' => ['src/Media/MediaService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http'],
];
