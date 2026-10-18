<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\RoleChange;
use App\Services\AuditLogger;
use App\Services\RoleChanger;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** Second-administrator approval for promotions to Administrator (decision #10). */
class RoleChangeController extends Controller
{
    /** POST /api/admin/role-changes/{roleChange}/approve */
    public function approve(Request $request, RoleChange $roleChange, RoleChanger $changer): AdminUserResource
    {
        $this->guard($request, $roleChange);
        $changer->apply($roleChange, $request->user());

        return new AdminUserResource($roleChange->user->refresh()->load(['area', 'coordinationPoint', 'pendingRoleChange']));
    }

    /** POST /api/admin/role-changes/{roleChange}/decline */
    public function decline(Request $request, RoleChange $roleChange): AdminUserResource
    {
        $this->guard($request, $roleChange);
        $reason = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']])['reason'];

        $roleChange->forceFill(['status' => 'declined', 'decided_by' => $request->user()->getKey(), 'decided_at' => now()])->save();
        AuditLogger::record($request->user(), 'user.role_change_declined', $roleChange->user, $roleChange->from_role->value, $roleChange->to_role->value, $reason);

        return new AdminUserResource($roleChange->user->refresh()->load(['area', 'coordinationPoint', 'pendingRoleChange']));
    }

    private function guard(Request $request, RoleChange $roleChange): void
    {
        if ($roleChange->status !== 'pending') {
            throw new ConflictHttpException('This role change was already decided.');
        }
        if ($roleChange->requested_by === $request->user()->getKey()) {
            throw new AccessDeniedHttpException('A different administrator must approve this change.');
        }
    }
}
