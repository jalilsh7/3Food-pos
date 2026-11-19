<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Security;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PersiaCoder\PosV3\Auth\AuthenticatedPrincipal;
use PersiaCoder\PosV3\Auth\BusinessScope;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Http\Request;
use PersiaCoder\PosV3\Http\Response;
use PersiaCoder\PosV3\Infrastructure\Database\IdempotencyRepository;
use PersiaCoder\PosV3\Infrastructure\Database\TransactionManager;
use RuntimeException;
use Throwable;

final readonly class IdempotencyMiddleware
{
    private IdempotencyRepository $repository;
    private TransactionManager $transactions;
    private string $encryptionKey;

    public function __construct(
        PDO $connection,
        string $applicationKey,
        private string $endpointCode,
    ) {
        if (strlen($applicationKey) < 32 || !function_exists('openssl_encrypt') || !function_exists('openssl_decrypt')) {
            throw new RuntimeException('A valid application key and OpenSSL are required for idempotency.');
        }
        if (!preg_match('/^[a-z][a-z0-9_.-]{1,99}$/', $endpointCode)) {
            throw new RuntimeException('Idempotency endpoint code is invalid.');
        }
        $this->repository = new IdempotencyRepository($connection);
        $this->transactions = new TransactionManager($connection);
        $this->encryptionKey = hash_hmac('sha256', 'POS_V3_IDEMPOTENCY_RESPONSE', $applicationKey, true);
    }

    /** @param callable(Request): Response $next */
    public function __invoke(Request $request, array $parameters, callable $next): Response
    {
        $principal = $request->attribute('principal');
        $scope = $request->attribute('business_scope');
        if (!$principal instanceof AuthenticatedPrincipal || !$scope instanceof BusinessScope) {
            throw new HttpException(500, 'idempotency_context_missing', 'The idempotency context is unavailable.');
        }

        $rawKey = trim($request->header('idempotency-key') ?? '');
        if (!preg_match('/^[A-Za-z0-9._~-]{16,128}$/', $rawKey)) {
            throw new HttpException(400, 'idempotency_key_required', 'A valid Idempotency-Key header is required.');
        }

        $keyHash = hash_hmac('sha256', $rawKey, $this->encryptionKey);
        $scopeHash = hash('sha256', $scope->businessId . ':' . ($scope->branchId ?? 'business'));
        $requestHash = hash('sha256', $request->method . "\n" . $request->path . "\n" . $request->body);
        $expiresAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
            ->modify('+24 hours')
            ->format('Y-m-d H:i:s.u');

        $record = $this->transactions->run(fn (PDO $connection): array =>
            $this->repository->createOrLock(
                $principal->userId,
                $scope->businessId,
                $scope->branchId,
                $scopeHash,
                $this->endpointCode,
                $keyHash,
                $requestHash,
                $expiresAt,
            )
        );

        if (!hash_equals($record['request_hash'], $requestHash)) {
            throw new HttpException(409, 'idempotency_key_reused', 'The idempotency key was already used for a different request.');
        }

        if ($record['response_status'] !== null) {
            $body = $this->decrypt(
                (string) $record['response_ciphertext'],
                (string) $record['response_nonce'],
                (string) $record['response_tag'],
                $this->aad($principal->userId, $scope, $keyHash, $requestHash),
            );
            return new Response((int) $record['response_status'], $body, [
                'Content-Type' => 'application/json; charset=utf-8',
                'Cache-Control' => 'no-store',
                'X-Content-Type-Options' => 'nosniff',
                'Idempotency-Replayed' => 'true',
            ]);
        }

        if (!$record['created']) {
            throw new HttpException(409, 'idempotency_in_progress', 'A request with this idempotency key is already processing.');
        }

        try {
            $response = $next($request);
            if ($response->status >= 200 && $response->status < 300) {
                [$ciphertext, $nonce, $tag] = $this->encrypt(
                    $response->body,
                    $this->aad($principal->userId, $scope, $keyHash, $requestHash),
                );
                $this->transactions->run(function (PDO $connection) use ($record, $response, $ciphertext, $nonce, $tag): void {
                    $this->repository->complete(
                        $record['id'],
                        $response->status,
                        $ciphertext,
                        $nonce,
                        $tag,
                    );
                });
            } else {
                $this->release($record['id']);
            }
            return $response;
        } catch (Throwable $exception) {
            $this->release($record['id']);
            throw $exception;
        }
    }

    private function release(int $recordId): void
    {
        $this->transactions->run(function (PDO $connection) use ($recordId): void {
            $this->repository->deletePending($recordId);
        });
    }

    /** @return array{string,string,string} */
    private function encrypt(string $plaintext, string $aad): array
    {
        $nonce = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt(
            $plaintext,
            'aes-256-gcm',
            $this->encryptionKey,
            OPENSSL_RAW_DATA,
            $nonce,
            $tag,
            $aad,
            16,
        );
        if (!is_string($ciphertext) || strlen($tag) !== 16) {
            throw new RuntimeException('Idempotency response encryption failed.');
        }
        return [$ciphertext, $nonce, $tag];
    }

    private function decrypt(string $ciphertext, string $nonce, string $tag, string $aad): string
    {
        $plaintext = openssl_decrypt(
            $ciphertext,
            'aes-256-gcm',
            $this->encryptionKey,
            OPENSSL_RAW_DATA,
            $nonce,
            $tag,
            $aad,
        );
        if (!is_string($plaintext)) {
            throw new HttpException(500, 'idempotency_replay_unavailable', 'The stored idempotent response could not be recovered.');
        }
        return $plaintext;
    }

    private function aad(
        int $actorUserId,
        BusinessScope $scope,
        string $keyHash,
        string $requestHash,
    ): string {
        return implode('|', [
            $actorUserId,
            $scope->businessId,
            $scope->branchId ?? 0,
            $this->endpointCode,
            $keyHash,
            $requestHash,
        ]);
    }
}
