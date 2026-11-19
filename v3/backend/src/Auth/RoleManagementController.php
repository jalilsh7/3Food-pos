<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Http\Request;
use PersiaCoder\PosV3\Http\Response;

final readonly class RoleManagementController
{
    public function __construct(private RoleManagementService $roles) {}

    public function list(Request $request): Response
    {
        return Response::success(['roles' => $this->roles->listRoles()]);
    }

    public function permissions(Request $request): Response
    {
        return Response::success(['permissions' => $this->roles->listPermissions()]);
    }

    public function create(Request $request): Response
    {
        [$code, $name, $permissions] = $this->rolePayload($request, true);
        $principal = $this->principal($request);
        $scope = $this->scope($request);
        $this->roles->createCustomRole($principal, $scope, $code, $name, $permissions, $request->requestId, (string) ($request->attribute('remote_ip') ?? ''));
        return Response::success(['created' => true, 'code' => $code], [], 201);
    }

    public function update(Request $request, array $parameters): Response
    {
        [, $name, $permissions] = $this->rolePayload($request, false);
        $principal = $this->principal($request);
        $scope = $this->scope($request);
        $this->roles->updateCustomRole($principal, $scope, $parameters['roleCode'], $name, $permissions, $request->requestId, (string) ($request->attribute('remote_ip') ?? ''));
        return Response::success(['updated' => true, 'code' => $parameters['roleCode']]);
    }

    public function assignBusiness(Request $request, array $parameters): Response
    {
        $principal = $this->principal($request);
        $scope = $this->scope($request);
        $roleCode = $this->roleCode($request);
        $this->roles->assignBusinessRole($principal, $parameters['userPublicId'], $roleCode, $scope, $request->requestId, (string) ($request->attribute('remote_ip') ?? ''));
        return Response::success(['assigned' => true], [], 201);
    }

    public function assignBranch(Request $request, array $parameters): Response
    {
        $principal = $this->principal($request);
        $scope = $this->scope($request);
        $roleCode = $this->roleCode($request);
        $this->roles->assignBranchRole($principal, $parameters['userPublicId'], $roleCode, $scope, $request->requestId, (string) ($request->attribute('remote_ip') ?? ''));
        return Response::success(['assigned' => true], [], 201);
    }

    public function removeBusiness(Request $request, array $parameters): Response
    {
        $principal = $this->principal($request);
        $scope = $this->scope($request);
        $removed = $this->roles->removeBusinessRole(
            $principal,
            $parameters['userPublicId'],
            $parameters['roleCode'],
            $scope,
            $request->requestId,
            (string) ($request->attribute('remote_ip') ?? ''),
        );
        return Response::success(['removed' => $removed]);
    }

    public function removeBranch(Request $request, array $parameters): Response
    {
        $principal = $this->principal($request);
        $scope = $this->scope($request);
        $removed = $this->roles->removeBranchRole(
            $principal,
            $parameters['userPublicId'],
            $parameters['roleCode'],
            $scope,
            $request->requestId,
            (string) ($request->attribute('remote_ip') ?? ''),
        );
        return Response::success(['removed' => $removed]);
    }

    private function rolePayload(Request $request, bool $includeCode): array
    {
        $contentType = strtolower(trim($request->header('content-type') ?? ''));
        if (!preg_match('/^application\/json(?:\s*;|$)/', $contentType)) {
            throw new HttpException(415, 'unsupported_media_type', 'Content-Type must be application/json.');
        }
        $payload = $request->json();
        $code = $payload['code'] ?? '';
        $name = $payload['name'] ?? null;
        $permissions = $payload['permissions'] ?? null;
        if (($includeCode && !is_string($code)) || !is_string($name) || !is_array($permissions)) {
            throw new HttpException(422, 'invalid_role_payload', 'Role code, name and permissions are required.');
        }
        return [$code, $name, $permissions];
    }

    private function roleCode(Request $request): string
    {
        $contentType = strtolower(trim($request->header('content-type') ?? ''));
        if (!preg_match('/^application\/json(?:\s*;|$)/', $contentType)) {
            throw new HttpException(415, 'unsupported_media_type', 'Content-Type must be application/json.');
        }
        $payload = $request->json();
        $code = $payload['role_code'] ?? null;
        if (!is_string($code)) {
            throw new HttpException(422, 'role_code_required', 'A role_code string is required.');
        }
        return $code;
    }

    private function principal(Request $request): AuthenticatedPrincipal
    {
        $principal = $request->attribute('principal');
        if (!$principal instanceof AuthenticatedPrincipal) {
            throw new HttpException(401, 'authentication_required', 'Authentication is required.');
        }
        return $principal;
    }

    private function scope(Request $request): BusinessScope
    {
        $scope = $request->attribute('business_scope');
        if (!$scope instanceof BusinessScope) {
            throw new HttpException(400, 'business_context_required', 'A valid business scope is required.');
        }
        return $scope;
    }
}
