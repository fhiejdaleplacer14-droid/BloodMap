<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Sanctum SPA cookie auth (54:244): GET /sanctum/csrf-cookie, then these.
 * Generic errors only — no account enumeration (54:242).
 */
class AuthController extends Controller
{
    /** 5 failed attempts → sign-in pauses for 15 minutes (23:373). */
    public const MAX_ATTEMPTS = 5;

    public const LOCKOUT_SECONDS = 900;

    public const GENERIC_ERROR = 'Email or password is incorrect';

    /** POST /login */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $key = 'login:'.Str::lower($credentials['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $minutes = (int) ceil(RateLimiter::availableIn($key) / 60);

            return response()->json([
                'message' => "Too many attempts. Try again in {$minutes} min.",
                'code' => 'locked_out',
                'retry_after' => RateLimiter::availableIn($key),
            ], 429);
        }

        $user = User::query()->where('email', Str::lower($credentials['email']))->first();
        $valid = $user && $user->deletion_requested_at === null && Hash::check($credentials['password'], $user->password);
        if (! $valid) {
            RateLimiter::hit($key, self::LOCKOUT_SECONDS);
            throw ValidationException::withMessages(['email' => self::GENERIC_ERROR]);
        }

        // Neutral explanation; no session is created (55:345).
        if ($user->isRestricted()) {
            return response()->json([
                'message' => 'This account can’t sign in right now. Contact support if you think this is a mistake.',
                'code' => 'account_restricted',
            ], 403);
        }

        RateLimiter::clear($key);
        Auth::guard('web')->login($user, (bool) ($credentials['remember'] ?? false));
        $request->session()->regenerate();
        $user->forceFill(['last_active_at' => now()])->saveQuietly();

        return (new MeResource($user->load(['area', 'coordinationPoint'])))->response();
    }

    /** POST /logout */
    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }

    /** POST /register — donor account; verification email sent ("Check your inbox", 23:883). */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'confirmed', self::passwordRule()],
            'terms' => ['accepted'],
            'email_saved_status_changes' => ['sometimes', 'boolean'],
        ], [
            'terms.accepted' => 'You need to accept to create an account.',
        ]);

        $email = Str::lower($data['email']);
        // Same response whether or not the address is taken (no enumeration).
        if (! User::query()->where('email', $email)->exists()) {
            $user = new User([
                'name' => $data['name'],
                'email' => $email,
                'password' => $data['password'],
                'preferences' => [
                    ...User::DEFAULT_PREFERENCES,
                    'email_saved_status_changes' => (bool) ($data['email_saved_status_changes'] ?? false),
                ],
            ]);
            $user->role = Role::Donor;
            $user->save();
            AuditLogger::record($user, 'account.registered', $user);
            event(new Registered($user));
        }

        return response()->json(['message' => 'Check your inbox to verify your email.'], 201);
    }

    /** POST /forgot-password — same message whether or not an account exists (23:1341). */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'string', 'email']]);
        Password::sendResetLink(['email' => Str::lower($request->string('email'))]);

        return response()->json(['message' => 'If an account exists for that email, we sent a reset link.']);
    }

    /** POST /reset-password — links work once and expire after 30 minutes (23:1456). */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'confirmed', self::passwordRule()],
        ]);

        $status = Password::reset(
            ['email' => Str::lower($data['email']), 'password' => $data['password'], 'password_confirmation' => $request->input('password_confirmation'), 'token' => $data['token']],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->setRememberToken(Str::random(60));
                $user->save();
                // "You'll be signed out on other devices" (23:1563).
                $user->revokeSessions();
                AuditLogger::record($user, 'account.password_reset', $user);
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'This link has expired or was already used',
                'code' => 'invalid_token',
            ], 422);
        }

        return response()->json(['message' => 'Your password was updated.']);
    }

    /**
     * Register / reset password requirements (23:653): at least 12 characters,
     * upper- and lowercase, a number or symbol, not a commonly used password.
     */
    public static function passwordRule(): PasswordRule
    {
        return PasswordRule::min(12)->mixedCase()->uncompromised()->rules([
            function (string $attribute, mixed $value, \Closure $fail) {
                if (! preg_match('/[\d\W_]/', (string) $value)) {
                    $fail('Use at least one number or symbol.');
                }
            },
        ]);
    }
}
