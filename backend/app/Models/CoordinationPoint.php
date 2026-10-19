<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A public facility desk. Requests attach here, never to a person (55:251).
 *
 * @property int $id
 * @property string $name
 * @property int $municipality_id
 * @property float $lat
 * @property float $lng
 * @property string|null $hours
 * @property string|null $phone
 * @property string|null $email
 * @property bool $is_demo
 */
class CoordinationPoint extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'municipality_id', 'lat', 'lng', 'hours', 'phone', 'email', 'is_demo'];

    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
            'is_demo' => 'boolean',
        ];
    }

    /** @return BelongsTo<Municipality, $this> */
    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }
}
