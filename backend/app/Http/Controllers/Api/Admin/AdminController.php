<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\AuditLog;
use App\Models\BloodRequest;
use App\Models\Municipality;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Administration (09): platform overview (38:2), coordinator coverage
 * (41:1289) and a read-out of the settings the platform runs with (41:2021).
 */
class AdminController extends Controller
{
    /** Audit actions shown under "Recent administrative activity". */
    private const ADMIN_ACTIONS = ['user.role_changed', 'user.role_change_requested', 'user.role_change_declined', 'user.restricted', 'user.unrestricted', 'user.password_reset_sent'];

    /** GET /api/admin/summary?days=7|30|90 */
    public function summary(Request $request): JsonResponse
    {
        $days = (int) ($request->validate(['days' => ['sometimes', 'in:7,30,90']])['days'] ?? 30);
        $tz = BloodRequest::LOCAL_TIME_ZONE;
        $start = now($tz)->startOfDay()->subDays($days - 1);
        $previousStart = $start->copy()->subDays($days);

        $pendingWaits = BloodRequest::query()->where('status', RequestStatus::PendingReview)->whereNotNull('first_submitted_at')
            ->pluck('first_submitted_at')
            ->map(fn ($at) => (int) Carbon::parse($at)->diffInMinutes(now()))
            ->sort()->values();
        $created = BloodRequest::query()->where('created_at', '>=', $start->copy()->utc());

        return response()->json(['data' => [
            'days' => $days,
            'from' => $start->toDateString(),
            'to' => now($tz)->toDateString(),
            'accounts' => [
                'total' => User::query()->whereNull('deletion_requested_at')->count(),
                'new' => User::query()->whereNull('deletion_requested_at')->where('created_at', '>=', $start->copy()->utc())->count(),
            ],
            'active' => [
                'total' => BloodRequest::query()->publiclyListed()->count(),
                'municipalities' => BloodRequest::query()->publiclyListed()->distinct()->count('municipality_id'),
            ],
            'pending' => [
                'total' => $pendingWaits->count(),
                'median_wait_minutes' => $pendingWaits->isEmpty() ? null : (int) $pendingWaits->median(),
            ],
            'expired' => [
                'total' => $this->auditCount('request.expired', $start, now()),
                'previous' => $this->auditCount('request.expired', $previousStart, $start),
            ],
            'series' => $this->dailySeries($start, $days),
            'statuses' => (clone $created)->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')
                ->map(fn ($n) => (int) $n),
            'municipalities' => $this->topMunicipalities($start),
            'recent' => AuditLog::query()->whereIn('action', self::ADMIN_ACTIONS)->with('actor:id,name')
                ->latest('created_at')->latest('id')->limit(4)->get()
                ->map(fn (AuditLog $log) => [
                    'id' => $log->getKey(),
                    'action' => $log->action,
                    'target' => $log->meta['target_label'] ?? null,
                    'from' => $log->from,
                    'to' => $log->to,
                    'actor' => $log->actor?->name,
                    'created_at' => $log->created_at?->toIso8601ZuluString(),
                ]),
        ]]);
    }

    /** GET /api/admin/coordinators — who reviews where, and which areas nobody covers. */
    public function coordinators(): JsonResponse
    {
        $coordinators = User::query()->where('role', Role::Coordinator)->whereNull('deletion_requested_at')
            ->with('area')->orderBy('name')->get();
        $since = now()->subDays(30);
        $reviews = AuditLog::query()
            ->whereIn('actor_id', $coordinators->modelKeys())
            ->whereIn('action', ['request.approved', 'request.correction_requested', 'request.rejected'])
            ->where('created_at', '>=', $since)
            ->toBase()->selectRaw('actor_id, action, count(*) as total')->groupBy('actor_id', 'action')->get()
            ->groupBy('actor_id');

        $covered = $coordinators->filter(fn (User $u) => ! $u->isRestricted())->pluck('area_id')->filter()->unique();
        $uncovered = Area::query()->whereNotIn('id', $covered->all())->orderBy('name')->get(['id', 'name', 'short_name']);

        return response()->json([
            'data' => $coordinators->map(function (User $u) use ($reviews) {
                $counts = collect($reviews->get($u->getKey(), []))->pluck('total', 'action');

                return [
                    'id' => $u->getKey(),
                    'name' => $u->name,
                    'email' => $u->email,
                    'initials' => $u->initials(),
                    'area' => $u->area?->only(['id', 'name', 'short_name']),
                    'restricted' => $u->isRestricted(),
                    'email_verified' => $u->hasVerifiedEmail(),
                    'last_active_at' => $u->last_active_at?->toIso8601ZuluString(),
                    'reviews_30d' => [
                        'approved' => (int) ($counts['request.approved'] ?? 0),
                        'corrections' => (int) ($counts['request.correction_requested'] ?? 0),
                        'rejected' => (int) ($counts['request.rejected'] ?? 0),
                    ],
                    'is_demo' => $u->is_demo,
                ];
            })->values(),
            'meta' => ['uncovered_areas' => $uncovered],
        ]);
    }

    /**
     * GET /api/admin/settings — the values the platform runs with today and
     * live health checks. Read-only: these live in code and the server
     * environment (decision #72); secrets are never returned.
     */
    public function settings(): JsonResponse
    {
        return response()->json(['data' => [
            'expiry' => [
                'default' => 'desk_window_close',
                'default_window_end' => BloodRequest::DEFAULT_WINDOW_END,
                'max_extension_hours' => BloodRequest::MAX_EXTENSION_HOURS,
                'reminder_hours' => 6,
                'job_frequency_minutes' => 5,
            ],
            'notifications' => [
                'owner_decisions' => true,
                'saver_updates' => 'per_user_preference',
                'weekly_digest' => false,
            ],
            'general' => [
                'platform_name' => config('app.name'),
                'timezone' => BloodRequest::LOCAL_TIME_ZONE,
                'default_map_area' => 'nir',
            ],
            'retention' => [
                'deleted_accounts_days' => 30,
                'deactivated_accounts_days' => 90,
                'inactive_saved_days' => 30,
                'location_precision' => 'municipality_centroid',
            ],
            'health' => $this->health(),
            'version' => [
                'api' => config('app.version', 'dev'),
                'laravel' => app()->version(),
                'php' => PHP_VERSION,
            ],
        ]]);
    }

    /** @return array<string, array<string, mixed>> */
    private function health(): array
    {
        $started = microtime(true);
        try {
            DB::select('select 1');
            $database = ['status' => 'operational', 'latency_ms' => (int) round((microtime(true) - $started) * 1000)];
        } catch (Throwable) {
            $database = ['status' => 'down', 'latency_ms' => null];
        }

        $failed = Schema::hasTable('failed_jobs')
            ? DB::table('failed_jobs')->where('failed_at', '>=', now()->subDay())->count()
            : null;

        return [
            'api' => ['status' => 'operational'],
            'database' => $database,
            'queue' => ['status' => $failed ? 'degraded' : 'operational', 'failed_24h' => $failed, 'driver' => config('queue.default')],
            'mail' => ['status' => 'operational', 'driver' => config('mail.default')],
        ];
    }

    private function auditCount(string $action, Carbon $from, Carbon $to): int
    {
        return AuditLog::query()->where('action', $action)
            ->where('created_at', '>=', $from->copy()->utc())->where('created_at', '<', $to->copy()->utc())->count();
    }

    /** @return list<array{date: string, created: int, expired: int}> */
    private function dailySeries(Carbon $start, int $days): array
    {
        $tz = BloodRequest::LOCAL_TIME_ZONE;
        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $series[$start->copy()->addDays($i)->toDateString()] = ['created' => 0, 'expired' => 0];
        }
        AuditLog::query()->whereIn('action', ['request.created', 'request.expired'])
            ->where('created_at', '>=', $start->copy()->utc())
            ->get(['action', 'created_at'])
            ->each(function (AuditLog $log) use (&$series, $tz) {
                $day = $log->created_at?->copy()->setTimezone($tz)->toDateString();
                if ($day !== null && isset($series[$day])) {
                    $series[$day][$log->action === 'request.created' ? 'created' : 'expired']++;
                }
            });

        return collect($series)->map(fn (array $c, string $date) => ['date' => $date, ...$c])->values()->all();
    }

    /** Top 6 municipalities by requests created in the period, with coordinator coverage of their area. */
    private function topMunicipalities(Carbon $start): Collection
    {
        $counts = BloodRequest::query()->where('created_at', '>=', $start->copy()->utc())
            ->toBase()->selectRaw('municipality_id, count(*) as total')->groupBy('municipality_id')
            ->orderByDesc('total')->limit(6)->pluck('total', 'municipality_id');
        $municipalities = Municipality::query()->whereKey($counts->keys()->all())->get()->keyBy('id');
        $coordinatorsPerArea = User::query()->where('role', Role::Coordinator)->whereNull('restricted_at')->whereNull('deletion_requested_at')
            ->toBase()->selectRaw('area_id, count(*) as total')->groupBy('area_id')->pluck('total', 'area_id');

        return $counts->map(function ($total, $id) use ($municipalities, $coordinatorsPerArea) {
            /** @var Municipality|null $m */
            $m = $municipalities->get($id);

            return [
                'id' => (int) $id,
                'name' => $m?->name,
                'province' => $m?->province,
                'requests' => (int) $total,
                'coordinators' => (int) ($coordinatorsPerArea[$m?->area_id] ?? 0),
            ];
        })->values();
    }
}
