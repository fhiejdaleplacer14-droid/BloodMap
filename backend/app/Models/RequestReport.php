<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $blood_request_id
 * @property int|null $reporter_id
 * @property string $reason
 * @property string|null $details
 * @property string $status
 * @property int|null $resolved_by
 * @property string|null $resolution_note
 * @property Carbon|null $resolved_at
 * @property Carbon|null $created_at
 * @property-read BloodRequest $bloodRequest
 * @property-read User|null $reporter
 * @property-read User|null $resolver
 */
class RequestReport extends Model
{
    /** What a signed-in visitor can flag (decision #94). */
    public const REASONS = ['no_longer_needed', 'wrong_details', 'personal_information', 'suspicious', 'other'];

    public const STATUSES = ['open', 'resolved', 'dismissed'];

    protected $fillable = ['reason', 'details'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    /** @return BelongsTo<BloodRequest, $this> */
    public function bloodRequest(): BelongsTo
    {
        return $this->belongsTo(BloodRequest::class);
    }

    /** @return BelongsTo<User, $this> */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    /** @return BelongsTo<User, $this> */
    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
