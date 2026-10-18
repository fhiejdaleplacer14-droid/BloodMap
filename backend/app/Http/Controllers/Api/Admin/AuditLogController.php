<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * GET /api/admin/audit-logs?actor&action&from&to[&format=csv] — read-only;
 * no update/delete routes exist (51:558). CSV export carries no contact data.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse|StreamedResponse
    {
        $filters = $request->validate([
            'actor' => ['sometimes', 'integer'],
            'action' => ['sometimes', 'string', 'max:100'],
            'target' => ['sometimes', 'string', 'max:60'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
            'format' => ['sometimes', 'in:json,csv'],
        ]);

        $query = AuditLog::query()
            ->with('actor:id,name,reference,role')
            ->when($filters['actor'] ?? null, fn (Builder $q, int $actor) => $q->where('actor_id', $actor))
            ->when($filters['action'] ?? null, fn (Builder $q, string $action) => $q->where('action', 'like', $action.'%'))
            ->when($filters['target'] ?? null, fn (Builder $q, string $label) => $q->where('meta->target_label', $label))
            ->when($filters['from'] ?? null, fn (Builder $q, string $from) => $q->where('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn (Builder $q, string $to) => $q->where('created_at', '<', now()->parse($to)->addDay()))
            ->latest('created_at')
            ->latest('id');

        if (($filters['format'] ?? 'json') === 'csv') {
            return $this->csv($query);
        }

        $page = $query->paginate(50)->withQueryString();

        return response()->json([
            'data' => $page->getCollection()->map(fn (AuditLog $log) => $this->row($log)),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function row(AuditLog $log): array
    {
        return [
            'id' => $log->getKey(),
            'created_at' => $log->created_at?->toIso8601ZuluString(),
            'actor' => $log->actor ? [
                'id' => $log->actor->getKey(),
                'name' => $log->actor->name,
                'role' => $log->actor->role->value,
            ] : null,
            'action' => $log->action,
            'target_type' => $log->target_type,
            'target' => $log->meta['target_label'] ?? null,
            'from' => $log->from,
            'to' => $log->to,
            'reason' => $log->reason,
        ];
    }

    /** @param  Builder<AuditLog>  $query */
    private function csv(Builder $query): StreamedResponse
    {
        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['id', 'created_at', 'actor', 'actor_role', 'action', 'target', 'from', 'to', 'reason']);
            $query->chunk(500, function ($logs) use ($out) {
                foreach ($logs as $log) {
                    $row = $this->row($log);
                    fputcsv($out, [
                        $row['id'], $row['created_at'], $row['actor']['name'] ?? 'system', $row['actor']['role'] ?? '',
                        $row['action'], $row['target'], $row['from'], $row['to'], $row['reason'],
                    ]);
                }
            });
            fclose($out);
        }, 'bloodmap-audit-log-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }
}
