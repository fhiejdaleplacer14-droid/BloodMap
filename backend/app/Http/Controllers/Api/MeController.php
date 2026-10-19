<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
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
        AuditLogger::record($user, 'account.preferences_updated', $user, meta: ['changes' => $validated]);

        return new MeResource($user->load(['area', 'coordinationPoint']));
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
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Your account will be deleted within 30 days.'], 202);
    }
}
