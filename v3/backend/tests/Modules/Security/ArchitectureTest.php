<?php
declare(strict_types=1);

return [
    'module' => 'Security',
    'required' => ['src/Security/IdempotencyStore.php', 'src/Security/TransactionBoundary.php', 'src/Security/AuditLogWriter.php', 'src/Security/AuditLogReader.php', 'src/Security/LoginAttemptStore.php', 'src/Security/PermissionChecker.php', 'src/Security/BusinessScopeContext.php', 'src/Security/GuestActorContext.php', 'src/Security/AuditRecorder.php', 'src/Security/IdempotencyExecutor.php'],
    'services' => ['src/Security/IdempotencyService.php', 'src/Security/AuditLogService.php', 'src/Security/LoginAttemptLimiter.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Http', 'Auth'],
    'contains' => [],
    'checks' => [
        ['src/Security/AuditLogService.php', ['implements AuditRecorder', 'Logger $logger', 'audit.recorded'], []],
        ['src/Security/IdempotencyService.php', ['implements IdempotencyExecutor', 'BusinessScopeContext $scope'], ['Http', 'Auth', 'PDO']],
        ['src/Auth/BusinessScope.php', ['implements BusinessScopeContext'], []],
        ['src/Security/BusinessContext.php', ['implements BusinessScopeContext'], []],
        ['src/Security/GuestActorContext.php', ['public string $guestPublicId'], ['public int $userId']],
    ],
];
