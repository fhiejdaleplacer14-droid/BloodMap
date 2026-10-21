<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property int $area_id
 * @property string $token_hash
 * @property int|null $invited_by
 * @property Carbon $expires_at
 * @property Carbon|null $accepted_at
 * @property Carbon|null $revoked_at
 * @property int|null $user_id
 * @property Carbon|null $created_at
 * @property-read Area $area
 */
class CoordinatorInvite extends Model
{
    public const VALID_DAYS = 7;

    protected $fillable = ['name', 'email', 'area_id', 'invited_by'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'accepted_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    /** A new link: returns the plain token (sent once by email, never stored). */
    public function issueToken(): string
    {
        $token = Str::random(48);
        $this->forceFill(['token_hash' => self::hash($token), 'expires_at' => now()->addDays(self::VALID_DAYS)]);

        return $token;
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findUsable(string $token): ?self
    {
        return self::query()->pending()->where('token_hash', self::hash($token))->where('expires_at', '>', now())->first();
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Not accepted and not revoked (expired ones included, so they can be resent).
     *
     * @param  Builder<self>  $query
     */
    public function scopePending(Builder $query): void
    {
        $query->whereNull('accepted_at')->whereNull('revoked_at');
    }

    /** @return BelongsTo<Area, $this> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }
}
