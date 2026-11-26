<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Updates;

use PersiaCoder\PosV3\Security\ActorContext;

/** Signed update discovery, planning, execution and package verification. */
interface UpdatesApplication
{
    public function getAvailableUpdates(string $installationId, string $currentVersion): array;

    public function planUpdate(ActorContext $actor, string $installationId, string $targetVersion): array;

    public function applyUpdate(ActorContext $actor, string $installationId, string $planPublicId, string $requestId): array;

    public function verifyManifest(string $manifestJson, string $signature, string $publicKey): bool;
}
