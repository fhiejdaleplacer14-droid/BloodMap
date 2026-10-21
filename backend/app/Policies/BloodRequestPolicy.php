<?php

namespace App\Policies;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Models\BloodRequest;
use App\Models\User;

/**
 * Policies decide every action (51:480). Coordinators act only inside their
 * area; administrators act everywhere. Restricted accounts can't act.
 */
class BloodRequestPolicy
{
    public function view(?User $user, BloodRequest $request): bool
    {
        if ($request->status->isPubliclyVisible() && $request->paused_at === null) {
            return true;
        }

        return $user !== null && ($this->owns($user, $request) || $this->reviews($user, $request));
    }

    public function create(User $user): bool
    {
        return $this->active($user)
            && $user->role === Role::FacilitySubmitter
            && $user->coordination_point_id !== null;
    }

    /** Draft / needs_correction / active (material edits go back to review). */
    public function update(User $user, BloodRequest $request): bool
    {
        return $this->active($user) && $this->owns($user, $request) && $request->status->isEditableBySubmitter();
    }

    public function submit(User $user, BloodRequest $request): bool
    {
        return $this->active($user)
            && $this->owns($user, $request)
            && in_array($request->status, [RequestStatus::Draft, RequestStatus::NeedsCorrection], true);
    }

    /** approve · request-correction · reject · assign (Coordinator in area, or Admin). */
    public function review(User $user, BloodRequest $request): bool
    {
        return $this->active($user) && $this->reviews($user, $request);
    }

    /** fulfill · close · extend (owner or coordinator). */
    public function manage(User $user, BloodRequest $request): bool
    {
        return $this->active($user)
            && $request->status === RequestStatus::Active
            && ($this->owns($user, $request) || $this->reviews($user, $request));
    }

    public function extend(User $user, BloodRequest $request): bool
    {
        return $this->manage($user, $request) && $request->extended_at === null;
    }

    /** Reveal the desk contact — audited (54:300). */
    public function revealContact(User $user, BloodRequest $request): bool
    {
        return $this->active($user) && $this->reviews($user, $request);
    }

    public function save(User $user, BloodRequest $request): bool
    {
        return $this->active($user) && $request->status->isPubliclyVisible();
    }

    /** "Report a problem" on a live listing; not on your own request (decision #94). */
    public function report(User $user, BloodRequest $request): bool
    {
        return $this->active($user) && $request->status === RequestStatus::Active && $request->submitter_id !== $user->getKey();
    }

    public function owns(User $user, BloodRequest $request): bool
    {
        return $request->submitter_id !== null && $request->submitter_id === $user->getKey();
    }

    public function reviews(User $user, BloodRequest $request): bool
    {
        if ($user->role === Role::Admin) {
            return true;
        }
        if ($user->role !== Role::Coordinator || $user->area_id === null) {
            return false;
        }

        $areaId = $request->relationLoaded('municipality')
            ? $request->municipality?->area_id
            : $request->municipality()->value('area_id');

        return $areaId === $user->area_id;
    }

    private function active(User $user): bool
    {
        return ! $user->isRestricted() && $user->deletion_requested_at === null;
    }
}
