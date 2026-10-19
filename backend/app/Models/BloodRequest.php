<?php

namespace App\Models;

use App\Enums\BloodType;
use App\Enums\ContactMethod;
use App\Enums\ContactVisibility;
use App\Enums\RequestCategory;
use App\Enums\RequestStatus;
use App\Enums\Urgency;
use App\Services\AuditLogger;
use Database\Factories\BloodRequestFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * A blood request. Public identifier BM-<year>-<nnnn>. Location is the
 * coordination point's municipality; only its centroid is ever public.
 *
 * @property int $id
 * @property string|null $public_id
 * @property int|null $submitter_id
 * @property int $coordination_point_id
 * @property int $municipality_id
 * @property BloodType $blood_type
 * @property int|null $units_requested
 * @property Carbon|null $needed_by
 * @property string|null $desk_window_start
 * @property string|null $desk_window_end
 * @property Urgency $urgency
 * @property RequestCategory|null $category
 * @property RequestStatus $status
 * @property string $public_summary
 * @property string $response_instructions
 * @property ContactMethod $contact_method
 * @property ContactVisibility $contact_visible_to
 * @property list<string>|null $screening_flags
 * @property bool $possible_duplicate
 * @property int|null $assigned_coordinator_id
 * @property int|null $reviewed_by
 * @property string|null $correction_note
 * @property string|null $rejection_reason
 * @property string|null $closure_reason
 * @property Carbon|null $first_submitted_at
 * @property Carbon|null $submitted_at
 * @property Carbon|null $published_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $extended_at
 * @property Carbon|null $expiry_reminder_sent_at
 * @property Carbon|null $paused_at
 * @property bool $is_demo
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class BloodRequest extends Model
{
    /** @use HasFactory<BloodRequestFactory> */
    use HasFactory;

    /** Fields whose change sends a live request back to review (55:338). */
    public const MATERIAL_FIELDS = ['blood_type', 'units_requested', 'coordination_point_id'];

    /** Owner/coordinator may extend expiry by at most this much, once per approval. */
    public const MAX_EXTENSION_HOURS = 72;

    protected $fillable = [
        'public_id', 'submitter_id', 'coordination_point_id', 'municipality_id',
        'blood_type', 'units_requested', 'needed_by', 'desk_window_start', 'desk_window_end', 'urgency',
        'category', 'status', 'public_summary', 'response_instructions', 'contact_method', 'contact_visible_to',
        'screening_flags', 'possible_duplicate',
        'assigned_coordinator_id', 'reviewed_by', 'correction_note', 'rejection_reason', 'closure_reason',
        'first_submitted_at', 'submitted_at', 'published_at', 'expires_at', 'extended_at',
        'expiry_reminder_sent_at', 'paused_at', 'is_demo',
    ];

    protected function casts(): array
    {
        return [
            'blood_type' => BloodType::class,
            'urgency' => Urgency::class,
            'status' => RequestStatus::class,
            'category' => RequestCategory::class,
            'contact_method' => ContactMethod::class,
            'contact_visible_to' => ContactVisibility::class,
            'screening_flags' => 'array',
            'possible_duplicate' => 'boolean',
            'needed_by' => 'date',
            'first_submitted_at' => 'datetime',
            'submitted_at' => 'datetime',
            'published_at' => 'datetime',
            'expires_at' => 'datetime',
            'extended_at' => 'datetime',
            'expiry_reminder_sent_at' => 'datetime',
            'paused_at' => 'datetime',
            'is_demo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (BloodRequest $request) {
            // Location always follows the coordination point.
            if ($request->coordination_point_id && ! $request->municipality_id) {
                $request->municipality_id = CoordinationPoint::query()
                    ->whereKey($request->coordination_point_id)
                    ->value('municipality_id');
            }
        });

        static::created(function (BloodRequest $request) {
            if (! $request->public_id) {
                // Seeded/imported requests carry their own IDs; step past any that are taken.
                $n = (int) $request->getKey();
                do {
                    $candidate = sprintf('BM-%d-%04d', $request->created_at->year, $n++);
                } while (static::query()->where('public_id', $candidate)->exists());
                $request->public_id = $candidate;
                $request->saveQuietly();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    /**
     * Move to a new status, enforcing the lifecycle (33:1787). Illegal moves
     * are a 409. Every transition writes an audit row.
     *
     * @param  array<string, mixed>  $attributes  extra columns set with the transition
     */
    public function transitionTo(RequestStatus $to, ?User $actor, string $action, ?string $reason = null, array $attributes = []): void
    {
        $from = $this->status;
        if (! $from->canTransitionTo($to)) {
            throw new ConflictHttpException("A {$from->value} request cannot become {$to->value}.");
        }

        $this->forceFill(['status' => $to, ...$attributes])->save();

        AuditLogger::record($actor, $action, $this, $from->value, $to->value, $reason);
    }

    /** Desk window and expiry are local times (55:386). */
    public const LOCAL_TIME_ZONE = 'Asia/Manila';

    /** End of the desk window when none is given. */
    public const DEFAULT_WINDOW_END = '17:00';

    /**
     * When the desk window closes on the needed-by date, in UTC. Expiry is
     * "automatically on Oct 18, 2026 · 17:00" (31:899).
     */
    public function windowClosesAt(): ?Carbon
    {
        if (! $this->needed_by) {
            return null;
        }
        $end = substr((string) ($this->desk_window_end ?: self::DEFAULT_WINDOW_END), 0, 5);

        return Carbon::parse($this->needed_by->toDateString().' '.$end, self::LOCAL_TIME_ZONE)->utc();
    }

    /**
     * The requester-stated window, derived from the needed-by time when the
     * request is submitted (decision #16) — never a triage level.
     */
    public function deriveUrgency(?Carbon $now = null): Urgency
    {
        $closes = $this->windowClosesAt();
        if (! $closes) {
            return Urgency::Scheduled;
        }
        $hours = ($now ?? now())->diffInHours($closes, false);

        return match (true) {
            $hours <= 24 => Urgency::Within24h,
            $hours <= 72 => Urgency::Within72h,
            default => Urgency::Scheduled,
        };
    }

    /** Same facility + blood type + submitter within 24 h (55:324). */
    public function findPossibleDuplicate(): ?self
    {
        return self::query()
            ->when($this->exists, fn (Builder $q) => $q->whereKeyNot($this->getKey()))
            ->where('submitter_id', $this->submitter_id)
            ->where('coordination_point_id', $this->coordination_point_id)
            ->where('blood_type', $this->blood_type)
            ->whereNotIn('status', [RequestStatus::Draft, RequestStatus::Rejected])
            ->where('created_at', '>=', now()->subDay())
            ->latest()
            ->first();
    }

    /** Expired, closed and rejected never re-open; fulfilled is done. */
    public function isLive(): bool
    {
        return $this->status === RequestStatus::Active && $this->paused_at === null;
    }

    /** @param  Builder<BloodRequest>  $query */
    public function scopePubliclyListed(Builder $query): void
    {
        $query->where('status', RequestStatus::Active)->whereNull('paused_at');
    }

    /**
     * @param  Builder<BloodRequest>  $query
     * @param  array{0: float, 1: float, 2: float, 3: float}  $bbox  minLng, minLat, maxLng, maxLat
     */
    public function scopeWithinBbox(Builder $query, array $bbox): void
    {
        [$minLng, $minLat, $maxLng, $maxLat] = $bbox;
        $query->whereHas('municipality', fn (Builder $m) => $m
            ->whereBetween('centroid_lng', [$minLng, $maxLng])
            ->whereBetween('centroid_lat', [$minLat, $maxLat]));
    }

    /** @param  Builder<BloodRequest>  $query */
    public function scopeInArea(Builder $query, int $areaId): void
    {
        $query->whereHas('municipality', fn (Builder $m) => $m->where('area_id', $areaId));
    }

    /** @return BelongsTo<User, $this> */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitter_id');
    }

    /** @return BelongsTo<CoordinationPoint, $this> */
    public function coordinationPoint(): BelongsTo
    {
        return $this->belongsTo(CoordinationPoint::class);
    }

    /** @return BelongsTo<Municipality, $this> */
    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    /** @return BelongsTo<User, $this> */
    public function assignedCoordinator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_coordinator_id');
    }

    /** @return BelongsToMany<User, $this> */
    public function savers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'saved_requests')->withPivot('created_at');
    }
}
