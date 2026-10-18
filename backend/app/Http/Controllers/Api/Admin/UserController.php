<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\BloodRequest;
use App\Models\RoleChange;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\RoleChanger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** User Management (09 · Admin, 39:441). Every change needs a reason and is audited. */
class UserController extends Controller
{
    /** GET /api/admin/users?q&role&area_id&status */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'role' => ['sometimes', Rule::enum(Role::class)],
            'area_id' => ['sometimes', 'integer', 'exists:areas,id'],
            'status' => ['sometimes', Rule::in(['active', 'restricted'])],
        ]);

        $users = User::query()
            ->whereNull('deletion_requested_at')
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $q->where(fn (Builder $w) => $w->where('name', 'ilike', $like)->orWhere('email', 'ilike', $like));
            })
            ->when($filters['role'] ?? null, fn (Builder $q, string $role) => $q->where('role', $role))
            ->when($filters['area_id'] ?? null, fn (Builder $q, int $area) => $q->where(fn (Builder $w) => $w
                ->where('area_id', $area)
                ->orWhereHas('coordinationPoint.municipality', fn (Builder $m) => $m->where('area_id', $area))))
            ->when(($filters['status'] ?? null) === 'restricted', fn (Builder $q) => $q->whereNotNull('restricted_at'))
            ->when(($filters['status'] ?? null) === 'active', fn (Builder $q) => $q->whereNull('restricted_at'))
            ->with(['area', 'coordinationPoint', 'pendingRoleChange'])
            ->orderBy('name')
            ->paginate(30)
            ->withQueryString();

        return AdminUserResource::collection($users);
    }

    /**
     * PATCH /api/admin/users/{user}/role. Promotion to Administrator creates a
     * pending change that a different administrator must approve (39:1074).
     */
    public function updateRole(Request $request, User $user, RoleChanger $changer): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::enum(Role::class)],
            'area_id' => ['required_if:role,coordinator', 'nullable', 'integer', 'exists:areas,id'],
            'coordination_point_id' => ['required_if:role,facility_submitter', 'nullable', 'integer', 'exists:coordination_points,id'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ]);
        /** @var User $admin */
        $admin = $request->user();

        if ($user->is($admin)) {
            throw new ConflictHttpException('You can’t change your own role.');
        }
        if ($user->pendingRoleChange()->exists()) {
            throw new ConflictHttpException('This user already has a role change waiting for approval.');
        }

        $change = RoleChange::create([
            'user_id' => $user->getKey(),
            'from_role' => $user->role,
            'to_role' => $data['role'],
            'area_id' => $data['role'] === Role::Coordinator->value ? $data['area_id'] : null,
            'coordination_point_id' => $data['role'] === Role::FacilitySubmitter->value ? $data['coordination_point_id'] : null,
            'reason' => $data['reason'],
            'requested_by' => $admin->getKey(),
            'status' => 'pending',
        ]);

        if ($change->to_role === Role::Admin) {
            AuditLogger::record($admin, 'user.role_change_requested', $user, $user->role->value, Role::Admin->value, $data['reason']);

            return (new AdminUserResource($user->load(['area', 'coordinationPoint', 'pendingRoleChange'])))
                ->response()->setStatusCode(202);
        }

        $changer->apply($change, $admin);

        return (new AdminUserResource($user->refresh()->load(['area', 'coordinationPoint', 'pendingRoleChange'])))->response();
    }

    /**
     * POST /api/admin/users/{user}/restrict — reason required; irreversible
     * by UI. Sessions revoked; open requests paused, not deleted (55:345).
     */
    public function restrict(Request $request, User $user): AdminUserResource
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']])['reason'];
        $admin = $request->user();

        if ($user->is($admin)) {
            throw new ConflictHttpException('You can’t restrict your own account.');
        }
        if ($user->isRestricted()) {
            throw new ConflictHttpException('This account is already restricted.');
        }

        DB::transaction(function () use ($user, $admin, $reason) {
            $user->forceFill(['restricted_at' => now(), 'restriction_reason' => $reason])->save();
            $paused = BloodRequest::query()
                ->where('submitter_id', $user->getKey())
                ->whereIn('status', [RequestStatus::Draft, RequestStatus::PendingReview, RequestStatus::NeedsCorrection, RequestStatus::Active])
                ->whereNull('paused_at')
                ->update(['paused_at' => now()]);

            AuditLogger::record($admin, 'user.restricted', $user, null, 'restricted', $reason, ['paused_requests' => $paused]);
        });
        $user->revokeSessions();

        return new AdminUserResource($user->refresh()->load(['area', 'coordinationPoint', 'pendingRoleChange']));
    }
}
