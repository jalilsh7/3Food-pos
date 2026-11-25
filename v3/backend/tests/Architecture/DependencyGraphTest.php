<?php
declare(strict_types=1);

/**
 * Static dependency graph guard. Application services/contracts may depend only
 * on their own module and shared Security/Support contracts.
 */
return static function (string $backendRoot): int {
    $sourceRoot = $backendRoot . '/src';
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceRoot, FilesystemIterator::SKIP_DOTS),
    );
    $scanned = 0;
    $violations = [];

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile() || $fileInfo->getExtension() !== 'php') {
            continue;
        }

        $path = $fileInfo->getPathname();
        $relative = substr($path, strlen($sourceRoot) + 1);
        $segments = explode(DIRECTORY_SEPARATOR, $relative);
        $module = $segments[0] ?? '';
        $basename = $fileInfo->getBasename();
        $content = file_get_contents($path);
        if (!is_string($content)) {
            $violations[] = "{$relative}: source could not be read";
            continue;
        }
        $scanned++;

        $isApplicationFile = str_ends_with($basename, 'Service.php')
            || str_ends_with($basename, 'Application.php');
        $isController = str_ends_with($basename, 'Controller.php');

        if ($isController && (str_contains($content, 'use PDO;') || str_contains($content, 'Infrastructure\\'))) {
            $violations[] = "{$relative}: HTTP controller imports PDO/Infrastructure";
        }

        if (!$isApplicationFile || in_array($module, ['Http', 'Infrastructure'], true)) {
            continue;
        }

        foreach (['use PDO;', 'Infrastructure\\', 'Http\\'] as $forbidden) {
            if (str_contains($content, $forbidden)) {
                $violations[] = "{$relative}: forbidden application dependency {$forbidden}";
            }
        }

        if ($module !== 'Auth' && str_contains($content, 'Auth\\')) {
            $violations[] = "{$relative}: non-Auth application code depends on Auth";
        }

        preg_match_all(
            '/^use\\s+PersiaCoder\\\\PosV3\\\\([A-Za-z][A-Za-z0-9_]*)\\\\/m',
            $content,
            $matches,
        );
        foreach ($matches[1] ?? [] as $dependency) {
            if (!in_array($dependency, [$module, 'Security', 'Support'], true)) {
                $violations[] = "{$relative}: cross-module dependency on {$dependency}";
            }
        }
    }

    if ($violations !== []) {
        throw new RuntimeException(implode("\n", array_unique($violations)));
    }

    return $scanned;
};
