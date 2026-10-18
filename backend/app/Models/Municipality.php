<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Municipality extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'province', 'area_id', 'centroid_lat', 'centroid_lng'];

    protected function casts(): array
    {
        return [
            'centroid_lat' => 'float',
            'centroid_lng' => 'float',
        ];
    }

    /** @return BelongsTo<Area, $this> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }
}
