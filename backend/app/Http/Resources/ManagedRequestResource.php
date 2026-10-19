<?php

namespace App\Http\Resources;

use App\Enums\RequestStatus;
use App\Models\BloodRequest;
use App\Models\User;
use App\Policies\BloodRequestPolicy;
use App\Services\DescriptionScreener;
use Illuminate\Http\Request;

/**
 * The request as seen by its submitter or a reviewing coordinator/admin:
 * public fields plus workflow state and policy-driven `can` flags that
 * decide which buttons render. Screening results and the submitter
 * reference are for reviewers only; the owner gets a live privacy review of
 * their public text for the submit step (31:840).
 *
 * @mixin BloodRequest
 */
class ManagedRequestResource extends PublicRequestResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var User $viewer */
        $viewer = $request->user();
        $policy = app(BloodRequestPolicy::class);
        $reviewer = $policy->reviews($viewer, $this->resource);
        $base = parent::toArray($request);

        return [
            ...$base,
            'municipality_id' => $this->municipality_id,
            'contact_method' => $this->contact_method->value,
            'contact_visible_to' => $this->contact_visible_to->value,
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'submitted_at' => $this->submitted_at?->toIso8601ZuluString(),
            'first_submitted_at' => $this->first_submitted_at?->toIso8601ZuluString(),
            'extended_at' => $this->extended_at?->toIso8601ZuluString(),
            'paused' => $this->paused_at !== null,
            'correction_note' => $this->correction_note,
            'rejection_reason' => $this->rejection_reason,
            'closure_reason' => $this->closure_reason,
            'checks' => $this->when($reviewer, fn () => [
                'flags' => $this->screening_flags ?? [],
                'possible_duplicate' => $this->possible_duplicate,
            ]),
            'privacy_review' => $this->when($policy->owns($viewer, $this->resource), fn () => [
                'flags' => app(DescriptionScreener::class)->screen($this->public_summary."\n".$this->response_instructions),
            ]),
            'submitter' => $this->when($reviewer, fn () => $this->submitter ? [
                'reference' => $this->submitter->reference,
                'role' => $this->submitter->role->value,
            ] : null),
            'assigned_coordinator' => $this->assignedCoordinator ? [
                'id' => $this->assignedCoordinator->getKey(),
                'name' => $this->assignedCoordinator->name,
                'initials' => $this->assignedCoordinator->initials(),
                'is_me' => $this->assignedCoordinator->is($viewer),
            ] : null,
            'can' => [
                ...$base['can'],
                'update' => $policy->update($viewer, $this->resource),
                'submit' => $policy->submit($viewer, $this->resource),
                'assign' => $reviewer && $this->status === RequestStatus::PendingReview,
                'approve' => $reviewer && $this->status === RequestStatus::PendingReview,
                'request_correction' => $reviewer && $this->status === RequestStatus::PendingReview,
                'reject' => $reviewer && $this->status === RequestStatus::PendingReview,
                'fulfill' => $policy->manage($viewer, $this->resource),
                'close' => $policy->manage($viewer, $this->resource),
                'extend' => $policy->extend($viewer, $this->resource),
                'reveal_contact' => $policy->revealContact($viewer, $this->resource),
            ],
        ];
    }
}
