<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use DateTimeZone;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\BusinessRepository;

final readonly class BranchManagementService
{
    public function __construct(private BusinessRepository $businesses) {}

    public function list(BusinessScope $scope): array
    {
        return $this->businesses->listBranches($scope->businessId);
    }

    public function create(
        BusinessScope $scope,
        string $name,
        string $code,
        ?string $timezone,
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
        $this->businesses->createBranch($publicId, $scope->businessId, $code, $name, $timezone);

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
