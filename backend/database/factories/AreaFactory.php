<?php

namespace Database\Factories;

use App\Models\Area;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Area>
 */
class AreaFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $name = 'Test Area '.fake()->unique()->numberBetween(1, 99999);

        return ['name' => $name, 'short_name' => $name];
    }
}
