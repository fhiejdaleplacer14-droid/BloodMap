<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One stored system setting; read through App\Services\Settings.
 *
 * @property int $id
 * @property string $key
 * @property mixed $value
 * @property int|null $updated_by
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    protected function casts(): array
    {
        return ['value' => 'json'];
    }
}
