<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
PosV3DatabaseTools::requireCli();

$pdo = PosV3DatabaseTools::connect();
$lock = PosV3DatabaseTools::acquireLock($pdo);

try {
    $baselinePath = dirname(__DIR__) . '/schema.sql';
    $baseline = $pdo->prepare('SELECT checksum FROM app_schema_migrations WHERE version = ?');
    $baseline->execute(['000_baseline']);
    $appliedBaseline = $baseline->fetchColumn();

    if (!is_string($appliedBaseline)) {
        throw new RuntimeException('V3 baseline is not installed. Run install.php on a new, empty database first.');
    }

    $baselineChecksum = hash_file('sha256', $baselinePath);
    if (!is_string($baselineChecksum) || !hash_equals($appliedBaseline, $baselineChecksum)) {
        throw new RuntimeException('Installed baseline checksum differs from repository. Never edit an installed baseline; create a forward migration.');
    }

    $directory = dirname(__DIR__) . '/migrations';
    if (!is_dir($directory)) {
        throw new RuntimeException('V3 migrations directory is missing.');
    }

    $manifestPath = $directory . '/manifest.php';
    if (!is_file($manifestPath)) {
        throw new RuntimeException('V3 migration ownership manifest is missing.');
    }
    $manifest = require $manifestPath;
    if (!is_array($manifest)) {
        throw new RuntimeException('V3 migration ownership manifest must return an array.');
    }

    $files = glob($directory . '/*.sql') ?: [];
    $versions = [];
    foreach ($files as $path) {
        $filename = basename($path);
        if (!preg_match('/^(\d{3,})_[a-z0-9][a-z0-9-]*\.sql$/', $filename)) {
            throw new RuntimeException("Invalid migration filename: {$filename}");
        }
        $version = substr($filename, 0, -4);
        $versions[$version] = $filename;

        $entry = $manifest[$version] ?? null;
        if (!is_array($entry)) {
            throw new RuntimeException("Migration {$filename} has no ownership metadata.");
        }
        $owner = $entry['owner'] ?? null;
        $risk = $entry['risk'] ?? null;
        $dependencies = $entry['depends_on'] ?? null;
        $tables = $entry['tables'] ?? null;
        if (!is_string($owner) || !preg_match('/^[A-Z][A-Za-z0-9]{1,39}$/', $owner)) {
            throw new RuntimeException("Migration {$filename} has an invalid owner.");
        }
        if (!is_string($risk) || !in_array($risk, ['low', 'medium', 'high'], true)) {
            throw new RuntimeException("Migration {$filename} has an invalid risk classification.");
        }
        if (!is_array($dependencies) || !array_is_list($dependencies) || !is_array($tables) || !array_is_list($tables)) {
            throw new RuntimeException("Migration {$filename} has invalid dependency/table metadata.");
        }
        foreach ($tables as $table) {
            if (!is_string($table) || !preg_match('/^[a-z][a-z0-9_]{1,63}$/', $table)) {
                throw new RuntimeException("Migration {$filename} contains an invalid table name in its manifest.");
            }
        }
    }

    foreach ($manifest as $version => $entry) {
        if (!is_string($version) || !isset($versions[$version]) || !is_array($entry)) {
            throw new RuntimeException("Migration manifest contains an unknown or invalid version: " . (string) $version);
        }
    }

    usort($files, static function (string $left, string $right): int {
        preg_match('/^(\d+)/', basename($left), $leftMatch);
        preg_match('/^(\d+)/', basename($right), $rightMatch);
        return ((int) $leftMatch[1] <=> (int) $rightMatch[1]) ?: strcmp($left, $right);
    });

    $lastSequence = null;
    $appliedLookup = $pdo->prepare('SELECT 1 FROM app_schema_migrations WHERE version = ? LIMIT 1');

    foreach ($files as $path) {
        $filename = basename($path);
        $version = substr($filename, 0, -4);
        preg_match('/^(\d+)/', $filename, $sequenceMatch);
        $sequence = (int) $sequenceMatch[1];

        if ($lastSequence === $sequence) {
            throw new RuntimeException("Duplicate migration sequence number: {$sequence}");
        }
        $lastSequence = $sequence;

        $entry = $manifest[$version];
        foreach ($entry['depends_on'] as $dependency) {
            if (!is_string($dependency) || !isset($versions[$dependency])) {
                throw new RuntimeException("Migration {$filename} declares an unknown dependency.");
            }
            preg_match('/^(\d+)/', $versions[$dependency], $dependencySequenceMatch);
            if ((int) $dependencySequenceMatch[1] >= $sequence) {
                throw new RuntimeException("Migration {$filename} depends on a later or same-sequence migration {$dependency}.");
            }
            $appliedLookup->execute([$dependency]);
            if ($appliedLookup->fetchColumn() === false) {
                throw new RuntimeException("Migration {$filename} requires {$dependency} to be applied first.");
            }
        }

        if (strlen($version) > 64) {
            throw new RuntimeException("Migration version exceeds 64 characters: {$filename}");
        }

        $checksum = hash_file('sha256', $path);
        if (!is_string($checksum)) {
            throw new RuntimeException("Could not calculate checksum for {$filename}");
        }

        $lookup = $pdo->prepare('SELECT checksum FROM app_schema_migrations WHERE version = ?');
        $lookup->execute([$version]);
        $existing = $lookup->fetchColumn();
        if (is_string($existing)) {
            if (!hash_equals($existing, $checksum)) {
                throw new RuntimeException("Checksum mismatch for applied migration {$filename}. Manual review required.");
            }
            continue;
        }

        $started = microtime(true);
        $statementCount = PosV3DatabaseTools::executeSqlFile($pdo, $path);
        $elapsed = (int) round((microtime(true) - $started) * 1000);
        $record = $pdo->prepare(
            'INSERT INTO app_schema_migrations(version, checksum, applied_at, execution_ms)
             VALUES(?, ?, UTC_TIMESTAMP(3), ?)'
        );
        $record->execute([$version, $checksum, max(0, $elapsed)]);
        echo "Applied {$filename} [{$entry['owner']}, {$entry['risk']}] ({$statementCount} statements, {$elapsed} ms).\n";
    }

    echo "V3 migrations complete.\n";
} finally {
    PosV3DatabaseTools::releaseLock($pdo, $lock);
}
