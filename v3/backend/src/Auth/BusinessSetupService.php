<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use DateTimeZone;
use PDO;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\BusinessRepository;
use PersiaCoder\PosV3\Infrastructure\Database\TransactionManager;

final readonly class BusinessSetupService
{
    private BusinessRepository $businesses;
    private TransactionManager $transactions;

    public function __construct(private PDO $connection)
    {
        $this->businesses = new BusinessRepository($connection);
        $this->transactions = new TransactionManager($connection);
    }

    /** @return array{business_id:string,business_name:string,branch_id:string,branch_name:string} */
    public function createInitialBusiness(
        int $ownerUserId,
        string $name,
        string $code,
        string $timezone,
        string $currency,
        string $branchName,
        string $branchCode,
    ): array {
        if (!$this->businesses->isInstallationOwner($ownerUserId)) {
            throw new HttpException(403, 'owner_required', 'Only the installation owner can complete initial setup.');
        }
        if ($this->businesses->countBusinesses() > 0) {
            throw new HttpException(409, 'business_already_configured', 'The initial business has already been configured.');
        }

        $name = trim($name);
        $code = strtolower(trim($code));
        $branchName = trim($branchName);
        $branchCode = strtolower(trim($branchCode));
        $timezone = trim($timezone);
        $currency = strtoupper(trim($currency));

        if ($name === '' || strlen($name) > 160) {
            throw new HttpException(422, 'invalid_business_name', 'Business name is required and must not exceed 160 bytes.');
        }
        if (!preg_match('/^[a-z0-9][a-z0-9-]{1,62}$/', $code)) {
            throw new HttpException(422, 'invalid_business_code', 'Business code must use 2-63 lowercase letters, digits or hyphens.');
        }
        if ($branchName === '' || strlen($branchName) > 160) {
            throw new HttpException(422, 'invalid_branch_name', 'Branch name is required and must not exceed 160 bytes.');
        }
        if (!preg_match('/^[a-z0-9][a-z0-9-]{1,62}$/', $branchCode)) {
            throw new HttpException(422, 'invalid_branch_code', 'Branch code must use 2-63 lowercase letters, digits or hyphens.');
        }
        if (!in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            throw new HttpException(422, 'invalid_timezone', 'The timezone is not recognized.');
        }
        if (!preg_match('/^[A-Z]{3}$/', $currency)) {
            throw new HttpException(422, 'invalid_currency', 'Currency must be a three-letter ISO code.');
        }

        $businessPublicId = self::uuidV4();
        $branchPublicId = self::uuidV4();
        $this->transactions->run(function (PDO $connection) use (
            $businessPublicId,
            $branchPublicId,
            $code,
            $name,
            $timezone,
            $currency,
            $branchCode,
            $branchName,
        ): void {
            $businessId = $this->businesses->createBusiness(
                $businessPublicId,
                $code,
                $name,
                $timezone,
                $currency,
            );
            $this->businesses->createBranch(
                $branchPublicId,
                $businessId,
                $branchCode,
                $branchName,
                $timezone,
            );
        });

        return [
            'business_id' => $businessPublicId,
            'business_name' => $name,
            'branch_id' => $branchPublicId,
            'branch_name' => $branchName,
        ];
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
