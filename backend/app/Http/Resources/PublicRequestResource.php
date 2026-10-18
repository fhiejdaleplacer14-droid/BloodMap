<?php

namespace App\Http\Resources;

use App\Enums\ContactMethod;
use App\Enums\ContactVisibility;
use App\Enums\RequestStatus;
use App\Models\BloodRequest;
use App\Models\User;
use App\Policies\BloodRequestPolicy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public request resource (Handoff 51:485). Resources decide every field:
 * location is the municipality centroid only — never an address or the
 * facility's coordinates — and contact is gated by contact_visible_to.
 *
 * @mixin BloodRequest
 */
class PublicRequestResource extends JsonResource
{
    public const PHONE_MASK = '09•• ••• ••••';

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var User|null $viewer */
        $viewer = $request->user();
        $policy = app(BloodRequestPolicy::class);

        return [
            'id' => $this->public_id,
            'blood_type' => $this->blood_type->value,
            'units_requested' => $this->units_requested,
            'needed_by' => $this->needed_by?->toDateString(),
            'desk_window' => $this->desk_window_start
                ? [substr((string) $this->desk_window_start, 0, 5), substr((string) $this->desk_window_end, 0, 5)]
                : null,
            'urgency' => $this->urgency->value,
            'category' => $this->category?->value,
            'status' => $this->status->value,
            'location' => [
                'municipality' => $this->municipality->name,
                'province' => $this->municipality->province,
                'point' => [(float) $this->municipality->centroid_lng, (float) $this->municipality->centroid_lat],
                'precision' => 'municipality',
            ],
            'coordination_point' => [
                'id' => $this->coordinationPoint->getKey(),
                'name' => $this->coordinationPoint->name,
                'hours' => $this->coordinationPoint->hours,
            ],
            'contact' => $this->contactFor($viewer, $policy),
            'public_summary' => $this->public_summary,
            'response_instructions' => $this->response_instructions,
            'published_at' => $this->published_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
            'expires_at' => $this->expires_at?->toIso8601ZuluString(),
            'is_demo' => $this->is_demo,
            'is_saved' => $viewer !== null && $this->isSavedBy($viewer),
            'can' => [
                'save' => $viewer !== null && $policy->save($viewer, $this->resource),
                'report' => $viewer !== null && $this->status === RequestStatus::Active,
            ],
        ];
    }

    /**
     * The coordination point's desk phone or email (31:588).
     * Owner → full. Coordinator of the area / admin → masked until an audited
     * reveal. Others → by contact_visible_to. Nothing once the request isn't live.
     *
     * @return array{method: string, value: string, masked: bool}|null
     */
    protected function contactFor(?User $viewer, BloodRequestPolicy $policy): ?array
    {
        [$method, $value] = match ($this->contact_method) {
            ContactMethod::DeskPhone => ['phone', $this->coordinationPoint->phone],
            ContactMethod::DeskEmail => ['email', $this->coordinationPoint->email],
            ContactMethod::None => [null, null],
        };
        if (! $method || ! $value) {
            return null;
        }

        if ($viewer && $policy->owns($viewer, $this->resource)) {
            return ['method' => $method, 'value' => $value, 'masked' => false];
        }
        if ($this->status !== RequestStatus::Active) {
            return null;
        }
        if ($viewer && $policy->reviews($viewer, $this->resource)) {
            return ['method' => $method, 'value' => self::mask($method, $value), 'masked' => true];
        }

        $allowed = match ($this->contact_visible_to) {
            ContactVisibility::Public => true,
            ContactVisibility::SignedIn => $viewer !== null,
            ContactVisibility::Coordinators => false,
        };

        return $allowed ? ['method' => $method, 'value' => $value, 'masked' => false] : null;
    }

    /** Phone → "09•• ••• ••••" (54:300); email → "s•••@domain". */
    public static function mask(string $method, string $value): string
    {
        if ($method === 'phone') {
            return self::PHONE_MASK;
        }
        [$local, $domain] = array_pad(explode('@', $value, 2), 2, '');

        return mb_substr($local, 0, 1).'•••@'.$domain;
    }

    private function isSavedBy(User $viewer): bool
    {
        if (isset($this->resource->is_saved_by_viewer)) {
            return (bool) $this->resource->is_saved_by_viewer;
        }

        return $this->savers()->whereKey($viewer->getKey())->exists();
    }
}
