<?php

namespace App\Http\Resources;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * GET /api/me. The SPA renders navigation from `permissions` — items a user
 * can't access are never rendered (51:298).
 *
 * @mixin User
 */
class MeResource extends JsonResource
{
    /** @var array<string, list<string>> */
    private const PERMISSIONS = [
        'donor' => ['requests.save'],
        'facility_submitter' => ['requests.save', 'requests.create', 'requests.own'],
        'coordinator' => ['requests.save', 'review.queue', 'review.activity'],
        'admin' => [
            'requests.save', 'review.queue', 'review.activity',
            'admin.users', 'admin.coordinators', 'admin.audit', 'admin.settings',
        ],
    ];

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getKey(),
            'name' => $this->name,
            'email' => $this->email,
            'initials' => $this->initials(),
            'email_verified' => $this->hasVerifiedEmail(),
            'role' => $this->role->value,
            'reference' => $this->reference,
            'area' => $this->area ? [
                'id' => $this->area->getKey(),
                'name' => $this->area->name,
                'short_name' => $this->area->short_name,
            ] : null,
            'coordination_point' => $this->coordinationPoint ? [
                'id' => $this->coordinationPoint->getKey(),
                'name' => $this->coordinationPoint->name,
            ] : null,
            'preferences' => $this->resolvedPreferences(),
            'permissions' => $this->isRestricted() ? [] : self::permissionsFor($this->role),
            'member_since' => $this->created_at?->toIso8601ZuluString(),
            'is_demo' => $this->is_demo,
        ];
    }

    /** @return list<string> */
    public static function permissionsFor(Role $role): array
    {
        return self::PERMISSIONS[$role->value];
    }
}
