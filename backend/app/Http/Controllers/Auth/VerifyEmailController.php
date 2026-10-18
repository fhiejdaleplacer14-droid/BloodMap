<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class VerifyEmailController extends Controller
{
    /** GET /email/verify/{id}/{hash} (signed) — then back to the SPA's sign-in. */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = User::query()->findOrFail($id);
        abort_unless(hash_equals(sha1($user->getEmailForVerification()), $hash), 403);

        if (! $user->hasVerifiedEmail() && $user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return redirect()->away(rtrim((string) config('app.frontend_url'), '/').'/login?verified=1');
    }

    /** POST /email/verification-notification — "Didn’t get it? Resend" (23:987). */
    public function resend(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'string', 'email']]);
        $user = User::query()->where('email', strtolower((string) $request->input('email')))->first();
        if ($user && ! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return response()->json(['message' => 'If that account needs verifying, we sent a new link.']);
    }
}
