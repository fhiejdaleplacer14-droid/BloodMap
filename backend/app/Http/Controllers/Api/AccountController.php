<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
use App\Models\AuditLog;
use App\Models\BloodRequest;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Profile & Privacy (29:890) and My Activity (29:625): account details,
 * sessions, password, deactivation and the user's own data export.
 */
class AccountController extends Controller
{
    /** Action groups for the My Activity "Action" filter. */
    public const ACTIVITY_GROUPS = [
        'saved' => ['request.saved', 'request.unsaved'],
        'preferences' => ['account.preferences_updated'],
        'sign_ins' => ['account.signed_in'],
        'account' => [
            'account.registered', 'account.updated', 'account.password_changed', 'account.password_reset',
            'account.deactivated', 'account.reactivated', 'account.deletion_requested',
        ],
        'requests' => [
            'request.created', 'request.edited', 'request.submitted', 'request.fulfilled', 'request.closed',
            'request.extended', 'request.approved', 'request.correction_requested', 'request.rejected',
            'request.assigned', 'request.contact_revealed',
        ],
    ];

    /** PATCH /api/me — name and email ("Edit account details"). A new email must be verified again. */
    public function update(Request $request): MeResource
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->getKey())],
        ]);

        $from = $user->only(array_keys($data));
        if (isset($data['email'])) {
            $data['email'] = Str::lower($data['email']);
        }
        $user->fill($data);
        $emailChanged = $user->isDirty('email');
        if ($emailChanged) {
            $user->email_verified_at = null;
        }
        $user->save();
        AuditLogger::record($user, 'account.updated', $user, meta: ['fields' => array_keys(array_diff_assoc($data, $from))]);
        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        return new MeResource($user->load(['area', 'coordinationPoint']));
    }

    /** PUT /api/me/password — signs out every other session (23:1563). */
    public function updatePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', AuthController::passwordRule()],
        ]);
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Your current password is incorrect.']);
        }

        $user->forceFill(['password' => $data['password'], 'password_changed_at' => now()])->save();
        $this->otherSessions($request)->delete();
        AuditLogger::record($user, 'account.password_changed', $user);

        return response()->json(['message' => 'Your password was updated.']);
    }

    /** GET /api/me/sessions — device and last activity only; never an IP address or location. */
    public function sessions(Request $request): JsonResponse
    {
        $current = $request->hasSession() ? $request->session()->getId() : null;

        $sessions = DB::table('sessions')
            ->where('user_id', $request->user()->getKey())
            ->orderByDesc('last_activity')
            ->get(['id', 'user_agent', 'last_activity'])
            ->map(fn (object $s) => [
                // A digest, so the session token itself never leaves the server.
                'id' => hash_hmac('sha256', (string) $s->id, (string) config('app.key')),
                'device' => AuthController::deviceLabel((string) $s->user_agent),
                'last_active_at' => now()->setTimestamp((int) $s->last_activity)->toIso8601ZuluString(),
                'current' => $s->id === $current,
            ]);

        return response()->json(['data' => $sessions]);
    }

    /** DELETE /api/me/sessions/{id} — sign out another device. */
    public function destroySession(Request $request, string $session): JsonResponse
    {
        $match = $this->otherSessions($request)->get(['id'])
            ->first(fn (object $s) => hash_equals(hash_hmac('sha256', (string) $s->id, (string) config('app.key')), $session));
        abort_if($match === null, 404);

        DB::table('sessions')->where('id', $match->id)->delete();
        AuditLogger::record($request->user(), 'account.session_ended', $request->user());

        return response()->json(['message' => 'Signed out of that device.']);
    }

    /** POST /api/me/deactivate — hides the account and stops email; signing in within 90 days restores it. */
    public function deactivate(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->forceFill(['deactivated_at' => now()])->save();
        AuditLogger::record($user, 'account.deactivated', $user);

        $user->revokeSessions();
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Your account is deactivated. Sign in within 90 days to restore it.']);
    }

    /** GET /api/me/activity?group=&from=&to= — the user's own actions, newest first. */
    public function activity(Request $request): JsonResponse
    {
        $request->validate([
            'group' => ['sometimes', Rule::in(array_keys(self::ACTIVITY_GROUPS))],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $tz = BloodRequest::LOCAL_TIME_ZONE;

        $logs = AuditLog::query()
            ->where('actor_id', $request->user()->getKey())
            ->when($request->input('group'), fn ($q, string $group) => $q->whereIn('action', self::ACTIVITY_GROUPS[$group]))
            ->when($request->input('from'), fn ($q, string $from) => $q->where('created_at', '>=', Carbon::parse($from, $tz)->startOfDay()->utc()))
            ->when($request->input('to'), fn ($q, string $to) => $q->where('created_at', '<=', Carbon::parse($to, $tz)->endOfDay()->utc()))
            ->latest('created_at')
            ->latest('id')
            ->paginate(30);

        // Current status of the requests involved (the Status column).
        $statuses = BloodRequest::query()
            ->whereIn('id', $logs->getCollection()->where('target_type', (new BloodRequest)->getMorphClass())->pluck('target_id'))
            ->pluck('status', 'id');

        return response()->json([
            'data' => $logs->getCollection()->map(fn (AuditLog $log) => self::activityRow($log, $statuses->get($log->target_id))),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /** GET /api/me/export — "Download my data": profile, preferences, saved requests and activity. */
    public function export(Request $request): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $payload = [
            'exported_at' => now()->toIso8601ZuluString(),
            'account' => [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'member_since' => $user->created_at?->toIso8601ZuluString(),
                'preferences' => $user->resolvedPreferences(),
            ],
            'saved_requests' => $user->savedRequests()->pluck('public_id'),
            'activity' => AuditLog::query()->where('actor_id', $user->getKey())->latest('created_at')->get()
                ->map(fn (AuditLog $log) => self::activityRow($log, null)),
        ];
        AuditLogger::record($user, 'account.data_exported', $user);

        return response()->streamDownload(
            fn () => print (json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            'bloodmap-my-data.json',
            ['Content-Type' => 'application/json'],
        );
    }

    /** @return array<string, mixed> */
    private static function activityRow(AuditLog $log, mixed $status): array
    {
        $isRequest = $log->target_type === (new BloodRequest)->getMorphClass();

        return [
            'id' => $log->getKey(),
            'action' => $log->action,
            'request' => $isRequest ? ($log->meta['target_label'] ?? null) : null,
            'request_status' => $status instanceof \BackedEnum ? $status->value : $status,
            'from' => $log->from,
            'to' => $log->to,
            // Coarse "Chrome · Android" for sign-ins; never an IP address.
            'device' => $log->meta['device'] ?? null,
            'changes' => $log->meta['changes'] ?? null,
            'created_at' => $log->created_at?->toIso8601ZuluString(),
        ];
    }

    private function otherSessions(Request $request): Builder
    {
        $current = $request->hasSession() ? $request->session()->getId() : '';

        return DB::table('sessions')->where('user_id', $request->user()->getKey())->where('id', '!=', $current);
    }
}
