<?php
declare(strict_types=1);

return [
    'module' => 'Security',
    'required' => ['src/Security/IdempotencyStore.php', 'src/Security/TransactionBoundary.php', 'src/Security/AuditLogWriter.php', 'src/Security/AuditLogReader.php', 'src/Security/LoginAttemptStore.php', 'src/Security/PermissionChecker.php', 'src/Security/BusinessScopeContext.php'],
    'services' => ['src/Security/IdempotencyService.php', 'src/Security/AuditLogService.php', 'src/Security/LoginAttemptLimiter.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Http', 'Auth'],
    'contains' => [],
];
