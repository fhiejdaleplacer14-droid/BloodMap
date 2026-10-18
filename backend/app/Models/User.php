<?php

namespace App\Models;

use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Notification switches on Profile › Notifications (29:1141–29:1149),
     * merged under stored values. Email only in this version.
     */
    public const DEFAULT_PREFERENCES = [
        'email_saved_status_changes' => true,
        'email_expiry_reminder' => true,
        'email_weekly_area_summary' => false,
    ];

    protected $fillable = ['name', 'email', 'password', 'preferences'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'preferences' => 'array',
            'restricted_at' => 'datetime',
            'deletion_requested_at' => 'datetime',
            'last_active_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    public function hasRole(Role ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    public function isRestricted(): bool
    {
        return $this->restricted_at !== null;
    }

    /** @return array<string, bool> */
    public function resolvedPreferences(): array
    {
        return array_merge(self::DEFAULT_PREFERENCES, $this->preferences ?? []);
    }

    public function initials(): string
    {
        return collect(preg_split('/\s+/', trim($this->name)) ?: [])
            ->filter()
            ->take(2)
            ->map(fn (string $part) => mb_strtoupper(mb_substr($part, 0, 1)))
            ->implode('');
    }

    /** Sign the user out everywhere (restriction, password reset). */
    public function revokeSessions(): void
    {
        DB::table('sessions')->where('user_id', $this->getKey())->delete();
        $this->forceFill(['remember_token' => null])->saveQuietly();
    }

    /** @return HasOne<RoleChange, $this> */
    public function pendingRoleChange(): HasOne
    {
        return $this->hasOne(RoleChange::class)->where('status', 'pending')->latestOfMany();
    }

    /** @return BelongsTo<Area, $this> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    /** @return BelongsTo<CoordinationPoint, $this> */
    public function coordinationPoint(): BelongsTo
    {
        return $this->belongsTo(CoordinationPoint::class);
    }

    /** @return HasMany<BloodRequest, $this> */
    public function submittedRequests(): HasMany
    {
        return $this->hasMany(BloodRequest::class, 'submitter_id');
    }

    /** @return BelongsToMany<BloodRequest, $this> */
    public function savedRequests(): BelongsToMany
    {
        return $this->belongsToMany(BloodRequest::class, 'saved_requests')->withPivot('created_at');
    }
}
