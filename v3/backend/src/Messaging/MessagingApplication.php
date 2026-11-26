<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Messaging;

use PersiaCoder\PosV3\Security\ActorContext;
use PersiaCoder\PosV3\Security\BusinessContext;

/** SMS templates, event dispatch, campaigns and delivery queries. */
interface MessagingApplication
{
    /** @param array<string,mixed> $variables */
    public function sendEvent(ActorContext $actor, BusinessContext $scope, string $eventCode, string $recipient, array $variables, string $idempotencyKey, string $requestId): array;

    /** @param array<string,mixed> $payload */
    public function createTemplate(ActorContext $actor, BusinessContext $scope, array $payload, string $idempotencyKey, string $requestId): array;

    public function submitTemplateForApproval(ActorContext $actor, BusinessContext $scope, string $templatePublicId, string $idempotencyKey, string $requestId): array;

    /** @param array<string,mixed> $criteria */
    public function sendCampaign(ActorContext $actor, BusinessContext $scope, array $criteria, string $message, string $idempotencyKey, string $requestId): array;

    public function getDeliveryStatus(ActorContext $actor, BusinessContext $scope, string $messagePublicId): array;
}
