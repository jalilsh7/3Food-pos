<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Auth;

use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Http\Request;
use PersiaCoder\PosV3\Http\Response;

final readonly class CurrentPermissionsController
{
    public function __construct(
        private PermissionService $permissions,
        private BusinessScopeResolver $scopes,
    ) {}

    public function list(Request $request): Response
    {
        $principal = $request->attribute('principal');
        if (!$principal instanceof AuthenticatedPrincipal) {
            throw new HttpException(401, 'authentication_required', 'Authentication is required.');
        }

        $scope = $this->scopes->resolve($request, false, true);
        return Response::success([
            'permission_codes' => $this->permissions->listGrantedPermissions($principal->userId, $scope),
            'business_id' => $scope->businessPublicId,
            'branch_id' => $scope->branchPublicId,
        ]);
    }
}
