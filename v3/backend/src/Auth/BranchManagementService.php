<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use DateTimeZone;
use PDO;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\AuditLogRepository;
use PersiaCoder\PosV3\Infrastructure\Database\BusinessRepository;
use PersiaCoder\PosV3\Infrastructure\Database\TransactionManager;
use PersiaCoder\PosV3\Security\AuditLogService;

final readonly class BranchManagementService
{
    private BusinessRepository $businesses;
    private TransactionManager $transactions;
    private AuditLogService $audit;

    public function __construct(PDO $connection)
    {
        $this->businesses = new BusinessRepository($connection);
        $this->transactions = new TransactionManager($connection);
        $this->audit = new AuditLogService(new AuditLogRepository($connection));
    }

    public function list(BusinessScope $scope): array
    {
        return $this->businesses->listBranches($scope->businessId);
    }

    public function create(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        string $name,
        string $code,
        ?string $timezone,
        string $requestId,
        string $ipAddress,
    ): array {
        $name = trim($name);
        $code = strtolower(trim($code));
        $timezone = trim((string) $timezone);
        $businessTimezone = $this->businesses->findBusinessTimezone($scope->businessId);
        if ($businessTimezone === null) {
            throw new HttpException(404, 'business_not_found', 'The business was not found.');
        }
        if ($name === '' || self::unicodeLength($name) > 160) {
            throw new HttpException(422, 'invalid_branch_name', 'Branch name is required and must not exceed 160 characters.');
        }
        if (!preg_match('/^[a-z0-9][a-z0-9-]{1,62}$/', $code)) {
            throw new HttpException(422, 'invalid_branch_code', 'Branch code must use 2-63 lowercase letters, digits or hyphens.');
        }
        if ($timezone === '') {
            $timezone = $businessTimezone;
        }
        if (!in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            throw new HttpException(422, 'invalid_timezone', 'The timezone is not recognized.');
        }

        $publicId = self::uuidV4();
        $this->transactions->run(function (PDO $connection) use (
            $publicId,
            $scope,
            $code,
            $name,
            $timezone,
            $actor,
            $requestId,
            $ipAddress,
        ): void {
            $this->businesses->createBranch($publicId, $scope->businessId, $code, $name, $timezone);
            $this->audit->record(
                $actor->userId,
                'branch.created',
                'branch',
                $publicId,
                null,
                ['business_id' => $scope->businessPublicId, 'code' => $code, 'name' => $name, 'timezone' => $timezone],
                null,
                $requestId,
                $ipAddress,
            );
        });

        return [
            'id' => $publicId,
            'name' => $name,
            'code' => $code,
            'timezone' => $timezone,
            'is_active' => true,
        ];
    }

    private static function unicodeLength(string $value): int
    {
        $count = preg_match_all('/./us', $value);
        return $count === false ? PHP_INT_MAX : $count;
    }

    private static function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-'
            . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }
}
