<?php

namespace App\Http\Controllers\Api;

use App\Enums\BloodType;
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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Submitter and owner actions (51:476 · 54:290). Drafts → submit → review;
 * owner or coordinator can fulfil, close (reason required) and extend.
 */
class RequestController extends Controller
{
    /** My Requests tabs (32:959) → statuses. */
    public const MINE_TABS = [
        'needs_action' => ['draft', 'needs_correction'],
        'active' => ['pending_review', 'active'],
        'closed' => ['fulfilled', 'closed', 'expired', 'rejected'],
    ];

    /**
     * GET /api/requests/mine?q&status&blood_type&created_after&tab — 20 per
     * page; meta.counts gives each tab's total under the same filters.
     */
    public function mine(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'status' => ['sometimes', 'nullable', Rule::in(RequestStatus::values())],
            'blood_type' => ['sometimes', 'nullable', Rule::in(BloodType::values())],
            'created_after' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'tab' => ['sometimes', 'nullable', Rule::in(['all', ...array_keys(self::MINE_TABS)])],
        ]);

        $base = BloodRequest::query()
            ->where('submitter_id', $request->user()->getKey())
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('public_id', 'ilike', $like)
                    ->orWhereHas('municipality', fn (Builder $m) => $m->where('name', 'ilike', $like)));
            })
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['blood_type'] ?? null, fn (Builder $q, string $type) => $q->where('blood_type', $type))
            ->when($filters['created_after'] ?? null, fn (Builder $q, string $date) => $q->where(
                'created_at', '>=', Carbon::parse($date, BloodRequest::LOCAL_TIME_ZONE)->startOfDay()->utc()
            ));

        /** @var array<string, int> $byStatus */
        $byStatus = (clone $base)->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')->all();
        $counts = ['all' => array_sum($byStatus)];
        foreach (self::MINE_TABS as $tab => $statuses) {
            $counts[$tab] = array_sum(array_intersect_key($byStatus, array_flip($statuses)));
        }
        $counts['draft'] = (int) ($byStatus['draft'] ?? 0);

        $tab = $filters['tab'] ?? 'all';
        $requests = $base
            ->when($tab !== 'all', fn (Builder $q) => $q->whereIn('status', self::MINE_TABS[$tab]))
            ->with(['municipality', 'coordinationPoint', 'assignedCoordinator'])
            ->latest('updated_at')
            ->paginate(20)
            ->withQueryString();

        return ManagedRequestResource::collection($requests)->additional(['meta' => ['counts' => $counts]]);
    }

    /** POST /api/requests — creates a draft (decision #7). */
    public function store(UpsertBloodRequest $request): JsonResponse
    {
        $this->authorize('create', BloodRequest::class);

        /** @var User $user */
        $user = $request->user();
        // One transaction: the row, its public ID and the audit entry land together.
        $bloodRequest = DB::transaction(function () use ($request, $user) {
            $bloodRequest = BloodRequest::create([
                ...$request->fields(),
                'submitter_id' => $user->getKey(),
                'coordination_point_id' => $user->coordination_point_id,
                'status' => RequestStatus::Draft,
                'is_demo' => (bool) $user->is_demo,
            ]);
            AuditLogger::record($user, 'request.created', $bloodRequest, null, RequestStatus::Draft->value);

            return $bloodRequest;
        });

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
                'actor' => $log->actor ? [
                    // Reviewers see submitter references, never names (35:462).
                    'name' => $reviewer && ! $log->actor->is($viewer) && $log->actor_id === $bloodRequest->submitter_id
                        ? ($log->actor->reference ?? $log->actor->name)
                        : $log->actor->name,
                    'is_me' => $log->actor->is($viewer),
                ] : null,
                'from' => $log->from,
                'to' => $log->to,
                'reason' => $log->reason,
                'fields' => $fields,
                'created_at' => $log->created_at?->toIso8601ZuluString(),
            ];
        }

        // "Previous review notes" (36:498): the submitter's track record, for reviewers only.
        $meta = $reviewer && $bloodRequest->submitter_id !== null ? ['submitter' => [
            'approved' => BloodRequest::query()->where('submitter_id', $bloodRequest->submitter_id)->whereNotNull('published_at')->count(),
            'corrections' => AuditLog::query()
                ->where('target_type', $bloodRequest->getMorphClass())
                ->where('action', 'request.correction_requested')
                ->whereIn('target_id', BloodRequest::query()->where('submitter_id', $bloodRequest->submitter_id)->select('id'))
                ->count(),
        ]] : (object) [];

        return response()->json(['data' => $events, 'meta' => $meta]);
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
