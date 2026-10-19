<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\AuditLog;
use App\Models\BloodRequest;
use App\Models\Municipality;
use App\Models\RoleChange;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\RoleChanger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** User Management (09 · Admin, 39:441). Every change needs a reason and is audited. */
class UserController extends Controller
{
    /** GET /api/admin/users?q&role&area_id&status — 20 per page. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $users = $this->filtered($request)
            ->with(['area', 'coordinationPoint', 'pendingRoleChange'])
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return AdminUserResource::collection($users);
    }

    /** GET /api/admin/users/export — the filtered list as CSV ("Export user list", 39:441). Audited. */
    public function export(Request $request): StreamedResponse
    {
        $users = $this->filtered($request)->with(['area', 'coordinationPoint'])->orderBy('name')->limit(10000)->get();
        AuditLogger::record($request->user(), 'admin.users_exported', $request->user(), meta: ['count' => $users->count()]);

        return response()->streamDownload(function () use ($users) {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                return;
            }
            fputcsv($out, ['name', 'email', 'role', 'status', 'area', 'desk', 'last_active_at', 'created_at'], escape: '');
            foreach ($users as $user) {
                fputcsv($out, [
                    $user->name, $user->email, $user->role->value, $this->status($user),
                    $user->area?->name, $user->coordinationPoint?->name,
                    $user->last_active_at?->toIso8601ZuluString(), $user->created_at?->toIso8601ZuluString(),
                ], escape: '');
            }
            fclose($out);
        }, 'bloodmap-users-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * GET /api/admin/users/{user} — account details drawer (39:833). Never
     * includes passwords, tokens, saved requests or preferences.
     */
    public function show(User $user): JsonResponse
    {
        $user->load(['area', 'coordinationPoint', 'pendingRoleChange']);
        $signIn = AuditLog::query()->where('actor_id', $user->getKey())->where('action', 'account.signed_in')->latest('created_at')->first();
        $reviews = $user->role === Role::Coordinator ? AuditLog::query()
            ->where('actor_id', $user->getKey())
            ->whereIn('action', ['request.approved', 'request.correction_requested', 'request.rejected'])
            ->where('created_at', '>=', now()->subDays(30))
            ->toBase()->selectRaw('action, count(*) as total')->groupBy('action')->pluck('total', 'action') : null;

        return response()->json(['data' => [
            ...(new AdminUserResource($user))->resolve(),
            'area_municipalities' => $user->area ? Municipality::query()->where('area_id', $user->area_id)->count() : null,
            'last_sign_in' => $signIn ? ['at' => $signIn->created_at?->toIso8601ZuluString(), 'device' => $signIn->meta['device'] ?? null] : null,
            'reviews_30d' => $reviews ? [
                'approved' => (int) ($reviews['request.approved'] ?? 0),
                'corrections' => (int) ($reviews['request.correction_requested'] ?? 0),
                'rejected' => (int) ($reviews['request.rejected'] ?? 0),
            ] : null,
            'restriction_reason' => $user->restriction_reason,
        ]]);
    }

    /** POST /api/admin/users/{user}/password-reset — "Send password reset email" (39:833). */
    public function passwordReset(Request $request, User $user): JsonResponse
    {
        Password::sendResetLink(['email' => $user->email]);
        AuditLogger::record($request->user(), 'user.password_reset_sent', $user);

        return response()->json(['message' => 'Password reset email sent.']);
    }

    /** POST /api/admin/users/{user}/unrestrict — "You can lift the restriction later" (39:1286). */
    public function unrestrict(Request $request, User $user): AdminUserResource
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']])['reason'];
        if (! $user->isRestricted()) {
            throw new ConflictHttpException('This account isn’t restricted.');
        }

        DB::transaction(function () use ($request, $user, $reason) {
            $user->forceFill(['restricted_at' => null, 'restriction_reason' => null])->save();
            // Requests paused by the restriction resume; anything that expired meanwhile stays expired.
            BloodRequest::query()->where('submitter_id', $user->getKey())->whereNotNull('paused_at')->update(['paused_at' => null]);
            AuditLogger::record($request->user(), 'user.unrestricted', $user, 'restricted', 'active', $reason);
        });

        return new AdminUserResource($user->refresh()->load(['area', 'coordinationPoint', 'pendingRoleChange']));
    }

    /** @return Builder<User> */
    private function filtered(Request $request): Builder
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'role' => ['sometimes', 'nullable', Rule::enum(Role::class)],
            'area_id' => ['sometimes', 'nullable', 'integer', 'exists:areas,id'],
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'unverified', 'restricted'])],
        ]);

        return User::query()
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
            ->when(($filters['status'] ?? null) === 'unverified', fn (Builder $q) => $q->whereNull('restricted_at')->whereNull('email_verified_at'))
            ->when(($filters['status'] ?? null) === 'active', fn (Builder $q) => $q->whereNull('restricted_at')->whereNotNull('email_verified_at'));
    }

    private function status(User $user): string
    {
        return match (true) {
            $user->isRestricted() => 'restricted',
            ! $user->hasVerifiedEmail() => 'unverified',
            default => 'active',
        };
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
