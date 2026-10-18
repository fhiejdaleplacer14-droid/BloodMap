<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * audit_logs (51:598): actor, action, target, from, to, reason, ip_hash.
 * IPs are stored only as a keyed hash.
 */
class AuditLogger
{
    /** @param  array<string, mixed>  $meta */
    public static function record(
        ?User $actor,
        string $action,
        Model $target,
        ?string $from = null,
        ?string $to = null,
        ?string $reason = null,
        array $meta = [],
    ): AuditLog {
        return AuditLog::create([
            'actor_id' => $actor?->getKey(),
            'action' => $action,
            'target_type' => $target->getMorphClass(),
            'target_id' => $target->getKey(),
            'from' => $from,
            'to' => $to,
            'reason' => $reason,
            'ip_hash' => self::ipHash(),
            'meta' => ['target_label' => self::label($target), ...$meta],
        ]);
    }

    /** Human-readable target for the audit log (request ID, user reference or name). */
    private static function label(Model $target): ?string
    {
        return match (true) {
            $target instanceof BloodRequest => $target->public_id,
            $target instanceof User => $target->reference ?? $target->name,
            default => null,
        };
    }

    private static function ipHash(): ?string
    {
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return null; // scheduler / artisan
        }
        $ip = request()->ip();

        return $ip ? hash_hmac('sha256', $ip, (string) config('app.key')) : null;
    }
}
