<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
use App\Models\CoordinatorInvite;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Accepting a coordinator invite (decision #95): the link proves the email,
 * so the account starts verified, bound to the invited area, and signed in.
 * Expired, revoked and used links all answer 404 alike.
 */
class InviteController extends Controller
{
    /** GET /api/invites/{token} */
    public function show(string $token): JsonResponse
    {
        $invite = CoordinatorInvite::findUsable($token) ?? abort(404, 'This invite link is no longer valid.');

        return response()->json(['data' => [
            'name' => $invite->name,
            'email' => $invite->email,
            'area' => $invite->area->name,
            'expires_at' => $invite->expires_at->toIso8601ZuluString(),
        ]]);
    }

    /** POST /invites/{token}/accept → signed in as the new coordinator. */
    public function accept(Request $request, string $token): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'password' => ['required', 'confirmed', AuthController::passwordRule()],
        ]);

        $user = DB::transaction(function () use ($token, $data) {
            $invite = CoordinatorInvite::query()->lockForUpdate()->find(CoordinatorInvite::findUsable($token)?->getKey());
            abort_if($invite === null, 404, 'This invite link is no longer valid.');
            abort_if(User::query()->where('email', $invite->email)->exists(), 409, 'An account with this email already exists. Sign in instead.');

            $user = new User(['name' => $data['name'], 'email' => $invite->email, 'password' => $data['password'], 'preferences' => User::DEFAULT_PREFERENCES]);
            $user->forceFill(['role' => Role::Coordinator, 'area_id' => $invite->area_id, 'email_verified_at' => now()])->save();
            $invite->forceFill(['accepted_at' => now(), 'user_id' => $user->getKey()])->save();
            AuditLogger::record($user, 'coordinator.invite_accepted', $user, to: Role::Coordinator->value, meta: ['invite_id' => $invite->getKey()]);

            return $user;
        });

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return (new MeResource($user->fresh()))->response()->setStatusCode(201);
    }
}
