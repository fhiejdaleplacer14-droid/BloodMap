<?php

namespace App\Http\Controllers\Api;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\ManagedRequestResource;
use App\Models\BloodRequest;
use App\Models\User;
use App\Notifications\RequestUpdate;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Coordinator review (08 · Coordinator, 51:526). Scoped to the coordinator's
 * area; administrators see every area. You verify the listing — not
 * medical facts.
 */
class ReviewController extends Controller
{
    /** Review Queue tabs (35:462). */
    public const TABS = ['unassigned', 'mine', 'needs_correction', 'all_open'];

    /** GET /api/coordinator/queue?tab=… */
    public function queue(Request $request): AnonymousResourceCollection
    {
        $tab = $request->validate(['tab' => ['sometimes', Rule::in(self::TABS)]])['tab'] ?? 'all_open';
        /** @var User $user */
        $user = $request->user();

        $requests = $this->tabQuery($user, $tab)
            ->with(['municipality', 'coordinationPoint', 'submitter', 'assignedCoordinator'])
            // Queue position = first submission, so corrections keep their place (55:331).
            ->orderBy('first_submitted_at')
            ->orderBy('id')
            ->paginate(30)
            ->withQueryString();

        return ManagedRequestResource::collection($requests)->additional([
            'counts' => collect(self::TABS)->mapWithKeys(fn (string $t) => [$t => $this->tabQuery($user, $t)->count()]),
        ]);
    }

    /** GET /api/coordinator/summary — Coordinator Overview counts. */
    public function summary(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $scoped = fn () => $this->scoped($user);

        return response()->json(['data' => [
            'area' => $user->area?->only(['id', 'name', 'short_name']),
            'pending_review' => $scoped()->where('status', RequestStatus::PendingReview)->count(),
            'unassigned' => $this->tabQuery($user, 'unassigned')->count(),
            'assigned_to_me' => $this->tabQuery($user, 'mine')->count(),
            'needs_correction' => $scoped()->where('status', RequestStatus::NeedsCorrection)->count(),
            'active' => $scoped()->publiclyListed()->count(),
            'expiring_24h' => $scoped()->publiclyListed()->whereBetween('expires_at', [now(), now()->addDay()])->count(),
        ]]);
    }

    /** POST /api/requests/{id}/assign — "Assign to me" (35:462). */
    public function assign(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $this->authorizeReview($request->user(), $bloodRequest);
        $user = $request->user();

        $from = $bloodRequest->assignedCoordinator?->name;
        $bloodRequest->forceFill(['assigned_coordinator_id' => $user->getKey()])->save();
        AuditLogger::record($user, 'request.assigned', $bloodRequest, $from, $user->name);

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/approve — publish; expiry from needed-by + desk window. */
    public function approve(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $user = $request->user();
        $this->authorizeReview($user, $bloodRequest);

        $expires = $bloodRequest->windowClosesAt();
        if (! $expires || $expires->isPast()) {
            throw new ConflictHttpException('The needed-by time has passed — request a correction instead.');
        }

        $bloodRequest->transitionTo(RequestStatus::Active, $user, 'request.approved', null, [
            'published_at' => now(),
            'expires_at' => $expires,
            'reviewed_by' => $user->getKey(),
            'assigned_coordinator_id' => $bloodRequest->assigned_coordinator_id ?? $user->getKey(),
            'correction_note' => null,
            // Extension allowance resets with every approval (54:289).
            'extended_at' => null,
            'expiry_reminder_sent_at' => null,
        ]);
        $this->notifyOwner($bloodRequest, 'approved');

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/request-correction — note required, visible to the submitter only. */
    public function requestCorrection(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $user = $request->user();
        $this->authorizeReview($user, $bloodRequest);
        $note = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:1000']])['reason'];

        $bloodRequest->transitionTo(RequestStatus::NeedsCorrection, $user, 'request.correction_requested', $note, [
            'correction_note' => $note,
            'reviewed_by' => $user->getKey(),
        ]);
        $this->notifyOwner($bloodRequest, 'needs_correction');

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/reject — reason required, kept in the audit log; terminal. */
    public function reject(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $user = $request->user();
        $this->authorizeReview($user, $bloodRequest);
        $reason = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:1000']])['reason'];

        $bloodRequest->transitionTo(RequestStatus::Rejected, $user, 'request.rejected', $reason, [
            'rejection_reason' => $reason,
            'reviewed_by' => $user->getKey(),
        ]);
        $this->notifyOwner($bloodRequest, 'rejected');

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/reveal-contact — audited (54:300). */
    public function revealContact(Request $request, BloodRequest $bloodRequest): JsonResponse
    {
        $this->authorize('revealContact', $bloodRequest);
        $bloodRequest->loadMissing('coordinationPoint');

        $contact = match ($bloodRequest->contact_method->value) {
            'desk_phone' => ['method' => 'phone', 'value' => $bloodRequest->coordinationPoint->phone],
            'desk_email' => ['method' => 'email', 'value' => $bloodRequest->coordinationPoint->email],
            default => null,
        };
        AuditLogger::record($request->user(), 'request.contact_revealed', $bloodRequest);

        return response()->json(['data' => $contact && $contact['value'] ? [...$contact, 'masked' => false] : null]);
    }

    /** Review actions: pending only, inside the area, and not assigned to someone else (409). */
    private function authorizeReview(User $user, BloodRequest $bloodRequest): void
    {
        $this->authorize('review', $bloodRequest);

        if ($bloodRequest->status !== RequestStatus::PendingReview) {
            throw new ConflictHttpException('This request is no longer waiting for review.');
        }
        if ($bloodRequest->assigned_coordinator_id !== null && $bloodRequest->assigned_coordinator_id !== $user->getKey()) {
            throw new ConflictHttpException('This request is assigned to another coordinator.');
        }
    }

    /** @return Builder<BloodRequest> */
    private function scoped(User $user): Builder
    {
        return BloodRequest::query()
            ->when($user->role !== Role::Admin, fn (Builder $q) => $q->inArea((int) $user->area_id));
    }

    /** @return Builder<BloodRequest> */
    private function tabQuery(User $user, string $tab): Builder
    {
        $query = $this->scoped($user);

        return match ($tab) {
            'unassigned' => $query->where('status', RequestStatus::PendingReview)->whereNull('assigned_coordinator_id'),
            'mine' => $query->where('status', RequestStatus::PendingReview)->where('assigned_coordinator_id', $user->getKey()),
            'needs_correction' => $query->where('status', RequestStatus::NeedsCorrection),
            default => $query->whereIn('status', [RequestStatus::PendingReview, RequestStatus::NeedsCorrection]),
        };
    }

    private function managed(BloodRequest $bloodRequest): ManagedRequestResource
    {
        return new ManagedRequestResource(
            $bloodRequest->refresh()->load(['municipality', 'coordinationPoint', 'submitter', 'assignedCoordinator'])
        );
    }

    private function notifyOwner(BloodRequest $bloodRequest, string $kind): void
    {
        $bloodRequest->submitter?->notify(new RequestUpdate($bloodRequest, $kind));
    }
}
