<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Support;

use RuntimeException;

final readonly class Configuration
{
    public function __construct(
        public string $environment,
        public bool $debug,
        public string $databaseHost,
        public int $databasePort,
        public string $databaseName,
        public string $databaseUsername,
        public string $databasePassword,
        public string $applicationKey,
    ) {}

    public static function fromEnvironment(): self
    {
        $environment = strtolower(trim(Environment::requiredString('POS_V3_APP_ENV')));
        if (!in_array($environment, ['production', 'staging', 'development', 'test'], true)) {
            throw new RuntimeException('POS_V3_APP_ENV must be production, staging, development or test.');
        }

        $debug = Environment::boolean('POS_V3_APP_DEBUG', false);
        if ($debug && !in_array($environment, ['development', 'test'], true)) {
            throw new RuntimeException('Debug mode is only permitted in development or test environments.');
        }

        $host = Environment::requiredString('POS_V3_DB_HOST');
        $username = Environment::requiredString('POS_V3_DB_USER');
        $databaseName = Environment::requiredString('POS_V3_DB_NAME');
        $databasePassword = Environment::requiredString('POS_V3_DB_PASSWORD', true);
        $applicationKey = Environment::requiredString('POS_V3_APP_KEY');
        if (strlen($applicationKey) < 32) {
            throw new RuntimeException('POS_V3_APP_KEY must contain at least 32 bytes.');
        }
        $portValue = Environment::string('POS_V3_DB_PORT', '3306');

        if (strlen($host) > 255 || !preg_match('/^[A-Za-z0-9.:-]+$/', $host)) {
            throw new RuntimeException('POS_V3_DB_HOST contains invalid characters.');
        }
        if (strlen($username) > 128 || preg_match('/[\x00-\x1F\x7F]/', $username)) {
            throw new RuntimeException('POS_V3_DB_USER contains invalid characters.');
        }
        if (!preg_match('/^[A-Za-z0-9_]+$/', $databaseName)) {
            throw new RuntimeException('POS_V3_DB_NAME must contain only letters, digits and underscores.');
        }
        if (!ctype_digit($portValue) || (int) $portValue < 1 || (int) $portValue > 65535) {
            throw new RuntimeException('POS_V3_DB_PORT must be an integer between 1 and 65535.');
        }

        return new self($environment, $debug, $host, (int) $portValue, $databaseName, $username, $databasePassword, $applicationKey);
    }
}
