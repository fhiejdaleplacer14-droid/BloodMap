<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A public facility desk. Requests attach here, never to a person (55:251). */
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
