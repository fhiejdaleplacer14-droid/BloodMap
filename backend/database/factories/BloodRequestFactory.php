<?php

namespace Database\Factories;

use App\Enums\BloodType;
use App\Enums\ContactMethod;
use App\Enums\ContactVisibility;
use App\Enums\RequestStatus;
use App\Enums\Urgency;
use App\Models\BloodRequest;
use App\Models\CoordinationPoint;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BloodRequest>
 */
class BloodRequestFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'submitter_id' => null,
            'coordination_point_id' => CoordinationPoint::factory(),
            'blood_type' => fake()->randomElement(BloodType::cases()),
            'units_requested' => 2,
            'needed_by' => now('Asia/Manila')->addDays(3)->toDateString(),
            'desk_window_start' => '08:00',
            'desk_window_end' => '17:00',
            'urgency' => Urgency::Within72h,
            'status' => RequestStatus::Draft,
            'public_summary' => '2 units requested for a scheduled procedure. Coordinate through the facility’s blood services desk.',
            'response_instructions' => 'Visit the blood services desk during desk hours.',
            'contact_method' => ContactMethod::DeskPhone,
            'contact_visible_to' => ContactVisibility::SignedIn,
            'is_demo' => true,
        ];
    }

    /** Fill municipality from the coordination point like the app does. */
    public function configure(): static
    {
        return $this->afterMaking(function (BloodRequest $request) {
            if (! $request->municipality_id && $request->coordination_point_id) {
                $request->municipality_id = CoordinationPoint::query()->whereKey($request->coordination_point_id)->value('municipality_id');
            }
        });
    }

    public function by(User $submitter): static
    {
        return $this->state(fn () => [
            'submitter_id' => $submitter->getKey(),
            'coordination_point_id' => $submitter->coordination_point_id ?? CoordinationPoint::factory(),
        ]);
    }

    public function pending(): static
    {
        return $this->state(fn () => [
            'status' => RequestStatus::PendingReview,
            'submitted_at' => now(),
            'first_submitted_at' => now(),
        ]);
    }

    public function active(): static
    {
        return $this->state(fn () => [
            'status' => RequestStatus::Active,
            'submitted_at' => now()->subHours(3),
            'first_submitted_at' => now()->subHours(3),
            'published_at' => now()->subHours(2),
            'expires_at' => now()->addDays(3),
        ]);
    }

    public function expired(): static
    {
        return $this->active()->state(fn () => [
            'status' => RequestStatus::Expired,
            'expires_at' => now()->subHour(),
        ]);
    }
}
