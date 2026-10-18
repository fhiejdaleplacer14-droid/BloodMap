<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\RoleChange;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Applies an approved role change and keeps the user's bindings consistent. */
class RoleChanger
{
    public function apply(RoleChange $change, User $decidedBy): void
    {
        DB::transaction(function () use ($change, $decidedBy) {
            $user = $change->user;
            $from = $user->role;

            $user->forceFill([
                'role' => $change->to_role,
                // Coordinators are bound to an area, submitters to one desk.
                'area_id' => $change->to_role === Role::Coordinator ? $change->area_id : null,
                'coordination_point_id' => $change->to_role === Role::FacilitySubmitter ? $change->coordination_point_id : null,
                'reference' => $user->reference ?? ($change->to_role === Role::FacilitySubmitter ? self::reference($user) : null),
            ])->save();

            $change->forceFill(['status' => 'approved', 'decided_by' => $decidedBy->getKey(), 'decided_at' => now()])->save();

            AuditLogger::record($decidedBy, 'user.role_changed', $user, $from->value, $change->to_role->value, $change->reason, [
                'requested_by' => $change->requested_by,
            ]);
        });
    }

    /** Submitter references shown instead of names in queues ("S-0142"). */
    public static function reference(User $user): string
    {
        return sprintf('S-%04d', $user->getKey());
    }
}
