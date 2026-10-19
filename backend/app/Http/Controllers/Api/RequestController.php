<?php

namespace App\Http\Controllers\Api;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpsertBloodRequest;
use App\Http\Resources\ManagedRequestResource;
use App\Jobs\RunAutomatedChecks;
use App\Models\AuditLog;
use App\Models\BloodRequest;
use App\Models\User;
use App\Notifications\RequestUpdate;
use App\Policies\BloodRequestPolicy;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Submitter and owner actions (51:476 · 54:290). Drafts → submit → review;
 * owner or coordinator can fulfil, close (reason required) and extend.
 */
class RequestController extends Controller
{
    /** GET /api/requests/mine */
    public function mine(Request $request): AnonymousResourceCollection
    {
        $request->validate(['status' => ['sometimes', Rule::in(RequestStatus::values())]]);

        $requests = BloodRequest::query()
            ->where('submitter_id', $request->user()->getKey())
            ->when($request->input('status'), fn (Builder $q, string $status) => $q->where('status', $status))
            ->with(['municipality', 'coordinationPoint', 'assignedCoordinator'])
            ->latest('updated_at')
            ->paginate(30)
            ->withQueryString();

        return ManagedRequestResource::collection($requests);
    }

    /** POST /api/requests — creates a draft (decision #7). */
    public function store(UpsertBloodRequest $request): JsonResponse
    {
        $this->authorize('create', BloodRequest::class);

        /** @var User $user */
        $user = $request->user();
        $bloodRequest = BloodRequest::create([
            ...$request->fields(),
            'submitter_id' => $user->getKey(),
            'coordination_point_id' => $user->coordination_point_id,
            'status' => RequestStatus::Draft,
            'is_demo' => (bool) $user->is_demo,
        ]);
        AuditLogger::record($user, 'request.created', $bloodRequest, null, RequestStatus::Draft->value);

        return $this->managed($bloodRequest)->response()->setStatusCode(201);
    }

    /**
     * PATCH /api/requests/{id}. On a live request, material fields (blood
     * type, units, facility) send it back to review; other fields update in
     * place and are logged (55:338).
     */
    public function update(UpsertBloodRequest $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $this->authorize('update', $bloodRequest);
        $user = $request->user();

        DB::transaction(function () use ($request, $bloodRequest, $user) {
            $bloodRequest->fill($request->fields());
            $materialChanged = $bloodRequest->isDirty(BloodRequest::MATERIAL_FIELDS);
            $changed = array_keys($bloodRequest->getDirty());
            if ($changed === []) {
                return;
            }

            if ($bloodRequest->status === RequestStatus::Active && $materialChanged) {
                $bloodRequest->transitionTo(RequestStatus::PendingReview, $user, 'request.edited_material', null, [
                    'submitted_at' => now(),
                    'urgency' => $bloodRequest->deriveUrgency(),
                ]);
                RunAutomatedChecks::dispatch($bloodRequest);

                return;
            }

            $bloodRequest->save();
            AuditLogger::record($user, 'request.edited', $bloodRequest, meta: ['fields' => $changed]);
        });

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/submit — → pending_review; runs automated checks (51:523). */
    public function submit(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $this->authorize('submit', $bloodRequest);

        $missing = collect([
            'needed_by' => $bloodRequest->needed_by,
            'public_summary' => $bloodRequest->public_summary,
            'municipality_id' => $bloodRequest->municipality_id,
        ])->filter(fn ($value) => blank($value))->keys();
        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages(
                $missing->mapWithKeys(fn (string $field) => [$field => 'Required before you can submit.'])->all()
            );
        }
        if ($bloodRequest->windowClosesAt()?->isPast()) {
            throw ValidationException::withMessages(['needed_by' => 'Date can’t be in the past.']);
        }

        $resubmit = $bloodRequest->status === RequestStatus::NeedsCorrection;
        $bloodRequest->transitionTo(
            RequestStatus::PendingReview,
            $request->user(),
            $resubmit ? 'request.resubmitted' : 'request.submitted',
            null,
            [
                'urgency' => $bloodRequest->deriveUrgency(),
                'submitted_at' => now(),
                // Edits re-enter the queue at their original position (55:331).
                'first_submitted_at' => $bloodRequest->first_submitted_at ?? now(),
            ],
        );
        RunAutomatedChecks::dispatch($bloodRequest);

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/fulfill — need met; removed from the map. */
    public function fulfill(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $this->authorize('manage', $bloodRequest);
        $reason = $request->validate(['reason' => ['sometimes', 'nullable', 'string', 'max:500']])['reason'] ?? null;

        $bloodRequest->transitionTo(RequestStatus::Fulfilled, $request->user(), 'request.fulfilled', $reason);
        $this->notifySavers($bloodRequest, 'status_changed');

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/close — ended early; reason required; terminal. */
    public function close(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $this->authorize('manage', $bloodRequest);
        $reason = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']])['reason'];

        $bloodRequest->transitionTo(RequestStatus::Closed, $request->user(), 'request.closed', $reason, ['closure_reason' => $reason]);
        $this->notifySavers($bloodRequest, 'status_changed');

        return $this->managed($bloodRequest);
    }

    /** POST /api/requests/{id}/extend — max +72 h, once per coordinator approval (54:289). */
    public function extend(Request $request, BloodRequest $bloodRequest): ManagedRequestResource
    {
        $this->authorize('extend', $bloodRequest);
        $hours = (int) ($request->validate([
            'hours' => ['sometimes', 'integer', 'min:1', 'max:'.BloodRequest::MAX_EXTENSION_HOURS],
        ])['hours'] ?? BloodRequest::MAX_EXTENSION_HOURS);

        $from = $bloodRequest->expires_at;
        $to = ($from ?? now())->copy()->addHours($hours);
        $bloodRequest->forceFill(['expires_at' => $to, 'extended_at' => now(), 'expiry_reminder_sent_at' => null])->save();
        AuditLogger::record(
            $request->user(), 'request.extended', $bloodRequest,
            $from?->toIso8601ZuluString(), $to->toIso8601ZuluString(),
        );

        return $this->managed($bloodRequest);
    }

    /**
     * GET /api/requests/{id}/history — read-only timeline from the audit log
     * for the owner or a reviewer (32:1978). Saves are donors' business and
     * never shown; contact reveals only to reviewers. Edits made while a
     * correction is open are folded into the resubmission ("Changed: …").
     */
    public function history(Request $request, BloodRequest $bloodRequest, BloodRequestPolicy $policy): JsonResponse
    {
        /** @var User $viewer */
        $viewer = $request->user();
        $reviewer = $policy->reviews($viewer, $bloodRequest);
        abort_unless($reviewer || $policy->owns($viewer, $bloodRequest), 404);

        $hidden = ['request.saved', 'request.unsaved', ...($reviewer ? [] : ['request.contact_revealed'])];
        $logs = AuditLog::query()
            ->where('target_type', $bloodRequest->getMorphClass())
            ->where('target_id', $bloodRequest->getKey())
            ->whereNotIn('action', $hidden)
            ->with('actor:id,name')
            ->orderBy('created_at')->orderBy('id')
            ->limit(500)
            ->get();

        $events = [];
        $status = null;
        $pendingFields = [];
        foreach ($logs as $log) {
            if ($log->action === 'request.edited') {
                /** @var list<string> $fields */
                $fields = $log->meta['fields'] ?? [];
                if ($status === RequestStatus::NeedsCorrection->value) {
                    $pendingFields = array_values(array_unique([...$pendingFields, ...$fields]));

                    continue;
                }
                if ($status === null || $status === RequestStatus::Draft->value) {
                    continue; // drafting isn't history
                }
            }

            $fields = $log->action === 'request.resubmitted' ? $pendingFields : ($log->meta['fields'] ?? []);
            if ($log->action === 'request.resubmitted') {
                $pendingFields = [];
            }
            if ($log->action !== 'request.extended' && $log->to !== null) {
                $status = $log->to;
            }

            $events[] = [
                'id' => $log->getKey(),
                'action' => $log->action,
                'actor' => $log->actor ? ['name' => $log->actor->name, 'is_me' => $log->actor->is($viewer)] : null,
                'from' => $log->from,
                'to' => $log->to,
                'reason' => $log->reason,
                'fields' => $fields,
                'created_at' => $log->created_at?->toIso8601ZuluString(),
            ];
        }

        return response()->json(['data' => $events]);
    }

    private function managed(BloodRequest $bloodRequest): ManagedRequestResource
    {
        return new ManagedRequestResource(
            $bloodRequest->refresh()->load(['municipality', 'coordinationPoint', 'submitter', 'assignedCoordinator'])
        );
    }

    private function notifySavers(BloodRequest $bloodRequest, string $kind): void
    {
        $bloodRequest->savers->each(fn (User $saver) => $saver->notify(new RequestUpdate($bloodRequest, $kind)));
    }
}
