<?php

namespace App\Models;

use App\Enums\Role;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property Role $from_role
 * @property Role $to_role
 * @property int|null $area_id
 * @property int|null $coordination_point_id
 * @property string $reason
 * @property int $requested_by
 * @property int|null $decided_by
 * @property string $status
 * @property Carbon|null $decided_at
 */
class RoleChange extends Model
{
    protected $fillable = [
        'user_id', 'from_role', 'to_role', 'area_id', 'coordination_point_id', 'reason',
        'requested_by', 'decided_by', 'status', 'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'from_role' => Role::class,
            'to_role' => Role::class,
            'decided_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
