<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class MeController extends Controller
{
    /** GET /api/me */
    public function show(Request $request): MeResource
    {
        return new MeResource($request->user()->load(['area', 'coordinationPoint']));
    }

    /** PATCH /api/me/preferences — instant-apply switches (29:1141). */
    public function updatePreferences(Request $request): MeResource
    {
        $keys = array_keys(User::DEFAULT_PREFERENCES);
        $validated = $request->validate(
            collect($keys)->mapWithKeys(fn (string $key) => [$key => ['sometimes', 'boolean']])->all()
        );

        /** @var User $user */
        $user = $request->user();
        $user->preferences = array_merge($user->resolvedPreferences(), $validated);
        $user->save();

        return new MeResource($user->load(['area', 'coordinationPoint']));
    }

    /**
     * GET /api/me/activity — the user's own actions (My Activity, 29:625),
     * newest first.
     */
    public function activity(Request $request): JsonResponse
    {
        $logs = AuditLog::query()
            ->where('actor_id', $request->user()->getKey())
            ->latest('created_at')
            ->latest('id')
            ->paginate(30);

        return response()->json([
            'data' => $logs->getCollection()->map(fn (AuditLog $log) => [
                'id' => $log->getKey(),
                'action' => $log->action,
                'target_type' => $log->target_type,
                'target' => $log->meta['target_label'] ?? null,
                'from' => $log->from,
                'to' => $log->to,
                'created_at' => $log->created_at?->toIso8601ZuluString(),
            ]),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * DELETE /api/me — typed confirmation (29:1432: "Type your email to
     * confirm"). Signs out everywhere; data is purged within 30 days by
     * users:purge-deleted.
     */
    public function destroy(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $request->validate([
            'confirmation' => ['required', 'string', Rule::in([$user->email])],
        ], [
            'confirmation.in' => 'Type your account email exactly to confirm.',
        ]);

        $user->forceFill(['deletion_requested_at' => now()])->save();
        AuditLogger::record($user, 'account.deletion_requested', $user);

        $user->revokeSessions();
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Your account will be deleted within 30 days.'], 202);
    }
}
