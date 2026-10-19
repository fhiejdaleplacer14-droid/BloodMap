<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * Insert-only (enforced by a database trigger as well).
 *
 * @property int $id
 * @property int|null $actor_id
 * @property string $action
 * @property string $target_type
 * @property int|null $target_id
 * @property string|null $from
 * @property string|null $to
 * @property string|null $reason
 * @property string|null $ip_hash
 * @property array<string, mixed> $meta
 * @property Carbon|null $created_at
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['actor_id', 'action', 'target_type', 'target_id', 'from', 'to', 'reason', 'ip_hash', 'meta'];

    protected function casts(): array
    {
        return ['meta' => 'array', 'created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('audit_logs is insert-only'));
        static::deleting(fn () => throw new LogicException('audit_logs is insert-only'));
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
