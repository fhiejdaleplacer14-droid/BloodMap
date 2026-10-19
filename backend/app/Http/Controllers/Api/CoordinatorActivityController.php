<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BloodRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Coordinator Activity Log (36:1105): read-only audit entries on requests in
 * the coordinator's area. Entries can't be edited or deleted (the table is
 * insert-only). Donors' saves never appear.
 */
class CoordinatorActivityController extends Controller
{
    /** Filterable actions, in the order of the Action select. */
    public const ACTIONS = [
        'request.created', 'request.submitted', 'request.resubmitted', 'request.assigned',
        'request.approved', 'request.correction_requested', 'request.rejected',
        'request.edited', 'request.edited_material', 'request.extended',
        'request.fulfilled', 'request.closed', 'request.expired', 'request.contact_revealed',
    ];

    private const EXPORT_LIMIT = 5000;

    /** GET /api/coordinator/activity?from&to&actor&action&target — 25 per page. */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $page = $this->filtered($request)->with('actor:id,name')->paginate(25)->withQueryString();

        $actorIds = ReviewController::areaAudit($user)->whereNotNull('actor_id')->distinct()->pluck('actor_id');
        $actors = User::query()->whereKey($actorIds)->orderBy('name')->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->getKey(), 'name' => $u->name]);

        return response()->json([
            'data' => collect($page->items())->map(fn (AuditLog $log) => $this->row($log))->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'actors' => $actors,
                'actions' => self::ACTIONS,
            ],
        ]);
    }

    /** GET /api/coordinator/activity/export — the same filters as CSV ("Export CSV", 36:1105). */
    public function export(Request $request): StreamedResponse
    {
        $logs = $this->filtered($request)->with('actor:id,name')->limit(self::EXPORT_LIMIT)->get();
        $tz = BloodRequest::LOCAL_TIME_ZONE;

        return response()->streamDownload(function () use ($logs, $tz) {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                return;
            }
            fputcsv($out, ['timestamp', 'actor', 'action', 'target', 'outcome', 'from', 'to', 'reason', 'fields'], escape: '');
            foreach ($logs as $log) {
                fputcsv($out, [
                    $log->created_at?->copy()->setTimezone($tz)->format('Y-m-d H:i:s'),
                    $log->actor !== null ? $log->actor->name : 'System',
                    $log->action,
                    $log->meta['target_label'] ?? '',
                    'success',
                    $log->from,
                    $log->to,
                    $log->reason,
                    implode(' ', $log->meta['fields'] ?? []),
                ], escape: '');
            }
            fclose($out);
        }, 'bloodmap-activity-'.now($tz)->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return Builder<AuditLog> */
    private function filtered(Request $request): Builder
    {
        /** @var User $user */
        $user = $request->user();
        $filters = $request->validate([
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'actor' => ['sometimes', 'nullable', 'string', 'max:20'],
            'action' => ['sometimes', 'nullable', Rule::in(self::ACTIONS)],
            'target' => ['sometimes', 'nullable', 'string', 'max:40'],
        ]);
        $tz = BloodRequest::LOCAL_TIME_ZONE;

        return ReviewController::areaAudit($user)
            ->when($filters['from'] ?? null, fn (Builder $q, string $d) => $q->where('created_at', '>=', Carbon::parse($d, $tz)->startOfDay()->utc()))
            ->when($filters['to'] ?? null, fn (Builder $q, string $d) => $q->where('created_at', '<=', Carbon::parse($d, $tz)->endOfDay()->utc()))
            ->when($filters['actor'] ?? null, fn (Builder $q, string $actor) => $actor === 'system'
                ? $q->whereNull('actor_id')
                : $q->where('actor_id', (int) $actor))
            ->when($filters['action'] ?? null, fn (Builder $q, string $action) => $q->where('action', $action))
            ->when($filters['target'] ?? null, fn (Builder $q, string $target) => $q->whereIn(
                'target_id',
                BloodRequest::query()->where('public_id', 'ilike', '%'.addcslashes($target, '%_\\').'%')->select('id'),
            ))
            ->latest('created_at')
            ->latest('id');
    }

    /** @return array<string, mixed> */
    private function row(AuditLog $log): array
    {
        return [
            'id' => $log->getKey(),
            'action' => $log->action,
            'actor' => $log->actor ? ['id' => $log->actor->getKey(), 'name' => $log->actor->name, 'initials' => $log->actor->initials()] : null,
            'target' => $log->meta['target_label'] ?? null,
            'from' => $log->from,
            'to' => $log->to,
            'reason' => $log->reason,
            'fields' => $log->meta['fields'] ?? [],
            'created_at' => $log->created_at?->toIso8601ZuluString(),
        ];
    }
}
