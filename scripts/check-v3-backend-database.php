<?php
declare(strict_types=1);

use PersiaCoder\PosV3\Infrastructure\Database\PdoConnectionFactory;
use PersiaCoder\PosV3\Support\Configuration;

$root = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($root): void {
    $prefix = 'PersiaCoder\\PosV3\\';
    if (!str_starts_with($class, $prefix)) return;
    $file = $root . '/v3/backend/src/' . str_replace('\\', DIRECTORY_SEPARATOR, substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) require $file;
});
$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

$config = new Configuration('test', false, '127.0.0.1', 3307, 'pos_v3_test', 'pos_test', 'not-in-dsn');
$dsn = PdoConnectionFactory::dsn($config);
$assert($dsn === 'mysql:host=127.0.0.1;port=3307;dbname=pos_v3_test;charset=utf8mb4', 'Unexpected PDO DSN.');
$assert(!str_contains($dsn, $config->databasePassword), 'Database password must never be part of the DSN.');

$badHost = new Configuration('test', false, '127.0.0.1;dbname=other', 3306, 'pos_v3_test', 'pos_test', '');
try {
    PdoConnectionFactory::dsn($badHost);
    throw new RuntimeException('Unsafe host must not be accepted.');
} catch (RuntimeException $exception) {
    $assert($exception->getMessage() !== 'Unsafe host must not be accepted.', 'Unsafe host was accepted.');
}

echo "V3 backend database configuration checks passed.\n";
