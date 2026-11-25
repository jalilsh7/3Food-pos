<?php
declare(strict_types=1);

$backendRoot = dirname(__DIR__);
$testFiles = glob(__DIR__ . '/Modules/*/ArchitectureTest.php') ?: [];
sort($testFiles);

$failures = [];
$checks = 0;

$read = static function (string $relativePath) use ($backendRoot): string {
    $path = $backendRoot . '/' . ltrim($relativePath, '/');
    $content = is_file($path) ? file_get_contents($path) : false;
    if (!is_string($content)) {
        throw new RuntimeException("Required source file is missing or unreadable: {$relativePath}");
    }
    return $content;
};

foreach ($testFiles as $testFile) {
    try {
        $spec = require $testFile;
        if (!is_array($spec) || !is_string($spec['module'] ?? null)) {
            throw new RuntimeException('Architecture test spec is invalid.');
        }
        $module = $spec['module'];

        foreach (($spec['required'] ?? []) as $requiredPath) {
            $read($requiredPath);
            $checks++;
        }

        foreach (($spec['services'] ?? []) as $servicePath) {
            $content = $read($servicePath);
            foreach (($spec['forbidden'] ?? []) as $needle) {
                if (str_contains($content, $needle)) {
                    throw new RuntimeException("{$servicePath} contains forbidden dependency token: {$needle}");
                }
                $checks++;
            }
            foreach (($spec['contains'] ?? []) as $needle) {
                if (!str_contains($content, $needle)) {
                    throw new RuntimeException("{$servicePath} is missing required contract token: {$needle}");
                }
                $checks++;
            }
        }

        if (isset($spec['migration_manifest'])) {
            $manifestPath = $backendRoot . '/' . ltrim($spec['migration_manifest'], '/');
            if (!is_file($manifestPath)) {
                throw new RuntimeException('Migration ownership manifest is missing.');
            }
            $manifest = require $manifestPath;
            if (!is_array($manifest)) {
                throw new RuntimeException('Migration ownership manifest must return an array.');
            }
            $migrationDirectory = dirname($manifestPath);
            $sqlFiles = glob($migrationDirectory . '/*.sql') ?: [];
            $fileVersions = array_map(static fn (string $file): string => substr(basename($file), 0, -4), $sqlFiles);
            $manifestVersions = array_keys($manifest);
            sort($fileVersions);
            sort($manifestVersions);
            if ($fileVersions !== $manifestVersions) {
                throw new RuntimeException('Migration SQL files and ownership manifest entries do not match.');
            }
            foreach ($manifest as $version => $entry) {
                if (!is_array($entry) || !is_string($entry['owner'] ?? null)
                    || !is_string($entry['risk'] ?? null) || !is_array($entry['depends_on'] ?? null)) {
                    throw new RuntimeException("Migration {$version} has incomplete owner/risk/dependency metadata.");
                }
                foreach ($entry['depends_on'] as $dependency) {
                    if (!is_string($dependency) || !isset($manifest[$dependency])) {
                        throw new RuntimeException("Migration {$version} has an unknown dependency.");
                    }
                }
                $checks++;
            }

            foreach ($sqlFiles as $sqlFile) {
                $version = substr(basename($sqlFile), 0, -4);
                $sql = file_get_contents($sqlFile);
                if (!is_string($sql)) {
                    throw new RuntimeException("Migration {$version} SQL is unreadable.");
                }
                preg_match_all(
                    '/\\b(?:CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?|ALTER\\s+TABLE|DROP\\s+TABLE(?:\\s+IF\\s+EXISTS)?)\\s+`?([a-z][a-z0-9_]*)`?/i',
                    $sql,
                    $matches
                );
                $sqlTables = array_values(array_unique($matches[1] ?? []));
                $declaredTables = array_values(array_unique($manifest[$version]['tables'] ?? []));
                sort($sqlTables);
                sort($declaredTables);
                if ($sqlTables !== $declaredTables) {
                    throw new RuntimeException("Migration {$version} SQL table targets do not match its ownership manifest.");
                }
                $checks++;
            }
        }

        foreach (($spec['checks'] ?? []) as [$path, $mustContain, $mustNotContain]) {
            $content = $read($path);
            foreach ($mustContain as $needle) {
                if (!str_contains($content, $needle)) {
                    throw new RuntimeException("{$path} is missing required token: {$needle}");
                }
                $checks++;
            }
            foreach ($mustNotContain as $needle) {
                if (str_contains($content, $needle)) {
                    throw new RuntimeException("{$path} contains forbidden token: {$needle}");
                }
                $checks++;
            }
        }

        echo "PASS {$module}\n";
    } catch (Throwable $exception) {
        $failures[] = basename(dirname($testFile)) . ': ' . $exception->getMessage();
        echo "FAIL " . basename(dirname($testFile)) . "\n";
    }
}

echo sprintf("%d architecture checks; %d module suites; %d failures.\n", $checks, count($testFiles), count($failures));
if ($failures !== []) {
    foreach ($failures as $failure) {
        fwrite(STDERR, $failure . "\n");
    }
    exit(1);
}
