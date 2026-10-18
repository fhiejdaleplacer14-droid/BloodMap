<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A coordinator's review area, e.g. "Negros Occidental (North)". */
class Area extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'short_name'];

    /** @return HasMany<Municipality, $this> */
    public function municipalities(): HasMany
    {
        return $this->hasMany(Municipality::class);
    }
}
