<?php

namespace Database\Factories;

use App\Models\CoordinationPoint;
use App\Models\Municipality;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CoordinationPoint>
 */
class CoordinationPointFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->city().' Blood Services Desk (demo)',
            'municipality_id' => Municipality::factory(),
            'lat' => fake()->randomFloat(5, 9.2, 11.0),
            'lng' => fake()->randomFloat(5, 122.4, 123.6),
            'hours' => 'Mon–Sat 08:00–17:00',
            'phone' => '0917 555 0100',
            'email' => 'desk@example.org',
            'is_demo' => true,
        ];
    }
}
