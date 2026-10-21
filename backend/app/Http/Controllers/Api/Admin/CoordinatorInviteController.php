<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CoordinatorInvite;
use App\Models\User;
use App\Notifications\CoordinatorInvitation;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * "Invite coordinator" (41:1289, decision #95). The invitee sets their own
 * password from an emailed link that expires after 7 days; only a hash of
 * the link's token is stored.
 */
class CoordinatorInviteController extends Controller
{
    /** POST /api/admin/coordinator-invites */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'area_id' => ['required', 'integer', 'exists:areas,id'],
        ]);
        $email = Str::lower($data['email']);

        if (User::query()->where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email' => 'This person already has an account. Change their role in User Management instead.']);
        }
        if (CoordinatorInvite::query()->pending()->where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email' => 'An invite to this address is already pending. Resend it from the list.']);
        }

        /** @var User $admin */
        $admin = $request->user();
        $invite = new CoordinatorInvite([...$data, 'email' => $email, 'invited_by' => $admin->getKey()]);
        $token = $invite->issueToken();
        $invite->save();

        $this->send($invite, $token);
        AuditLogger::record($admin, 'coordinator.invited', $invite, to: $invite->area->name, meta: ['target_label' => $email]);

        return response()->json(['data' => self::present($invite)], 201);
    }

    /** POST /api/admin/coordinator-invites/{invite}/resend — a fresh link and 7 more days. */
    public function resend(Request $request, CoordinatorInvite $invite): JsonResponse
    {
        $this->assertPending($invite);
        $token = $invite->issueToken();
        $invite->save();

        $this->send($invite, $token);
        AuditLogger::record($request->user(), 'coordinator.invite_resent', $invite, meta: ['target_label' => $invite->email]);

        return response()->json(['data' => self::present($invite)]);
    }

    /** DELETE /api/admin/coordinator-invites/{invite} — the link stops working. */
    public function destroy(Request $request, CoordinatorInvite $invite): JsonResponse
    {
        $this->assertPending($invite);
        $invite->forceFill(['revoked_at' => now()])->save();
        AuditLogger::record($request->user(), 'coordinator.invite_revoked', $invite, meta: ['target_label' => $invite->email]);

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    public static function present(CoordinatorInvite $invite): array
    {
        return [
            'id' => $invite->getKey(),
            'name' => $invite->name,
            'email' => $invite->email,
            'area' => $invite->area->only(['id', 'name', 'short_name']),
            'invited_at' => $invite->created_at?->toIso8601ZuluString(),
            'expires_at' => $invite->expires_at->toIso8601ZuluString(),
            'expired' => $invite->isExpired(),
        ];
    }

    private function assertPending(CoordinatorInvite $invite): void
    {
        if ($invite->accepted_at !== null || $invite->revoked_at !== null) {
            throw new ConflictHttpException('This invite was already accepted or revoked.');
        }
    }

    private function send(CoordinatorInvite $invite, string $token): void
    {
        Notification::route('mail', $invite->email)->notify(new CoordinatorInvitation($invite->loadMissing('area'), $token));
    }
}
