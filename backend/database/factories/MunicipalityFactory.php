<?php

namespace Database\Factories;

use App\Models\Area;
use App\Models\Municipality;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Municipality>
 */
class MunicipalityFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => 'Test City '.fake()->unique()->numberBetween(1, 99999),
            'province' => 'Negros Occidental',
            'area_id' => Area::factory(),
            // Inside Negros Island Region.
            'centroid_lat' => fake()->randomFloat(4, 9.2, 11.0),
            'centroid_lng' => fake()->randomFloat(4, 122.4, 123.6),
        ];
    }
}
