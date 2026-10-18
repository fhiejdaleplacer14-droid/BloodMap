<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\Area;
use App\Models\CoordinationPoint;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'role' => Role::Donor,
            'preferences' => User::DEFAULT_PREFERENCES,
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }

    public function coordinator(?Area $area = null): static
    {
        return $this->state(fn () => [
            'role' => Role::Coordinator,
            'area_id' => $area?->getKey() ?? Area::factory(),
        ]);
    }

    public function submitter(?CoordinationPoint $point = null): static
    {
        return $this->state(fn () => [
            'role' => Role::FacilitySubmitter,
            'coordination_point_id' => $point?->getKey() ?? CoordinationPoint::factory(),
        ])->afterCreating(fn (User $user) => $user->forceFill(['reference' => sprintf('S-%04d', $user->getKey())])->saveQuietly());
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => Role::Admin]);
    }

    public function restricted(): static
    {
        return $this->state(fn () => ['restricted_at' => now(), 'restriction_reason' => 'Test restriction']);
    }
}
