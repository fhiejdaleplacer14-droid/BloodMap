<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** User row in User Management (39:441). Passwords and tokens are never included. */
/** @mixin User */
class AdminUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getKey(),
            'name' => $this->name,
            'email' => $this->email,
            'initials' => $this->initials(),
            'role' => $this->role->value,
            'reference' => $this->reference,
            'area' => $this->area?->only(['id', 'name', 'short_name']),
            'coordination_point' => $this->coordinationPoint?->only(['id', 'name']),
            'email_verified' => $this->hasVerifiedEmail(),
            'restricted' => $this->isRestricted(),
            'restricted_at' => $this->restricted_at?->toIso8601ZuluString(),
            'pending_role_change' => $this->pendingRoleChange ? [
                'id' => $this->pendingRoleChange->getKey(),
                'to_role' => $this->pendingRoleChange->to_role->value,
                'requested_by' => $this->pendingRoleChange->requested_by,
            ] : null,
            'last_active_at' => $this->last_active_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'is_demo' => $this->is_demo,
        ];
    }
}
