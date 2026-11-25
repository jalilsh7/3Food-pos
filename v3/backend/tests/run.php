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
