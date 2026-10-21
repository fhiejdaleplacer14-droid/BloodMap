<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\BloodRequest;
use App\Models\RequestReport;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * "Report a problem" (decision #94): a signed-in visitor flags a live request
 * and the coordinators for its area triage it on Reports (35:12). Reporters
 * are shown by reference only, never by name.
 */
class ReportController extends Controller
{
    /** POST /api/requests/{id}/reports — one open report per person per request. */
    public function store(Request $request, BloodRequest $bloodRequest): JsonResponse
    {
        $this->authorize('report', $bloodRequest);
        $data = $request->validate([
            'reason' => ['required', Rule::in(RequestReport::REASONS)],
            'details' => ['nullable', 'string', 'max:500', 'required_if:reason,other'],
        ], ['details.required_if' => 'Tell us what’s wrong.']);

        /** @var User $user */
        $user = $request->user();
        $existing = RequestReport::query()
            ->where('blood_request_id', $bloodRequest->getKey())
            ->where('reporter_id', $user->getKey())
            ->where('status', 'open')
            ->first();
        if ($existing) {
            return response()->json(['data' => ['id' => $existing->getKey(), 'status' => 'open', 'duplicate' => true]]);
        }

        $report = new RequestReport($data);
        $report->blood_request_id = $bloodRequest->getKey();
        $report->reporter_id = $user->getKey();
        $report->save();
        AuditLogger::record($user, 'request.reported', $bloodRequest, to: $data['reason'], meta: ['report_id' => $report->getKey()]);

        return response()->json(['data' => ['id' => $report->getKey(), 'status' => 'open', 'duplicate' => false]], 201);
    }

    /** GET /api/coordinator/reports?status=open|closed — the area's reports, newest first, 20 per page. */
    public function index(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['sometimes', Rule::in(['open', 'closed'])]])['status'] ?? 'open';
        /** @var User $user */
        $user = $request->user();

        $page = $this->scoped($user)
            ->when($status === 'open', fn (Builder $q) => $q->where('status', 'open'), fn (Builder $q) => $q->where('status', '!=', 'open'))
            ->with(['bloodRequest.municipality', 'reporter:id,reference,role', 'resolver:id,name'])
            ->latest($status === 'open' ? 'created_at' : 'resolved_at')->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => collect($page->items())->map(fn (RequestReport $r) => $this->present($r, $user))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'counts' => [
                    'open' => $this->scoped($user)->where('status', 'open')->count(),
                    'closed' => $this->scoped($user)->where('status', '!=', 'open')->count(),
                ],
            ],
        ]);
    }

    /** POST /api/coordinator/reports/{report}/resolve — resolved (acted on) or dismissed, with an optional note. */
    public function resolve(Request $request, RequestReport $report): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($this->scoped($user)->whereKey($report->getKey())->exists(), 404);
        if ($report->status !== 'open') {
            throw new ConflictHttpException('This report was already handled.');
        }

        $data = $request->validate([
            'resolution' => ['required', Rule::in(['resolved', 'dismissed'])],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $report->forceFill([
            'status' => $data['resolution'],
            'resolved_by' => $user->getKey(),
            'resolution_note' => $data['note'] ?? null,
            'resolved_at' => now(),
        ])->save();
        AuditLogger::record($user, 'report.'.$data['resolution'], $report->bloodRequest, 'open', $data['resolution'], $data['note'] ?? null, [
            'report_id' => $report->getKey(),
            'report_reason' => $report->reason,
        ]);

        return response()->json(['data' => $this->present($report->load(['bloodRequest.municipality', 'reporter:id,reference,role', 'resolver:id,name']), $user)]);
    }

    /** @return Builder<RequestReport> */
    public static function scoped(User $user): Builder
    {
        return RequestReport::query()->when($user->role !== Role::Admin, fn (Builder $q) => $q->whereHas(
            'bloodRequest', fn (Builder $r) => $r->inArea((int) $user->area_id)
        ));
    }

    /** @return array<string, mixed> */
    private function present(RequestReport $r, User $viewer): array
    {
        $request = $r->bloodRequest;

        return [
            'id' => $r->getKey(),
            'reason' => $r->reason,
            'details' => $r->details,
            'status' => $r->status,
            'request' => [
                'id' => $request->public_id,
                'blood_type' => $request->blood_type->value,
                'status' => $request->status->value,
                'municipality' => $request->municipality?->name,
            ],
            // By reference only (41:1616); donors have none, so their role stands in.
            'reporter' => $r->reporter ? ($r->reporter->reference ?? $r->reporter->role->value) : null,
            'reported_at' => $r->created_at?->toIso8601ZuluString(),
            'resolved_by' => $r->resolver ? ($r->resolver->is($viewer) ? 'you' : $r->resolver->name) : null,
            'resolution_note' => $r->resolution_note,
            'resolved_at' => $r->resolved_at?->toIso8601ZuluString(),
        ];
    }
}
