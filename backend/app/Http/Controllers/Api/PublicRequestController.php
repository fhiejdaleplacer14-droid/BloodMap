<?php

namespace App\Http\Controllers\Api;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequestsRequest;
use App\Http\Resources\ManagedRequestResource;
use App\Http\Resources\PublicRequestResource;
use App\Models\BloodRequest;
use App\Policies\BloodRequestPolicy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class PublicRequestController extends Controller
{
    public const PER_PAGE = 30;

    /** GET /api/requests — anyone; live requests only; bbox + filters; 30 per page. */
    public function index(SearchRequestsRequest $request): AnonymousResourceCollection
    {
        $viewer = $request->user();

        $statuses = $request->statuses();

        $query = BloodRequest::query()
            // Status filter (25:599): Active · Recently fulfilled (last 7 days).
            ->where(fn (Builder $w) => $w
                ->when(in_array('active', $statuses, true), fn (Builder $q) => $q->orWhere(fn (Builder $a) => $a->publiclyListed()))
                ->when(in_array('fulfilled', $statuses, true), fn (Builder $q) => $q->orWhere(fn (Builder $f) => $f
                    ->where('status', RequestStatus::Fulfilled)
                    ->whereNull('paused_at')
                    ->where('updated_at', '>=', now()->subDays(SearchRequestsRequest::RECENTLY_FULFILLED_DAYS)))))
            ->with(['municipality', 'coordinationPoint'])
            ->when($viewer, fn (Builder $q) => $q->withExists([
                'savers as is_saved_by_viewer' => fn (Builder $s) => $s->whereKey($viewer->getKey()),
            ]))
            ->when($request->bbox(), fn (Builder $q, array $bbox) => $q->withinBbox($bbox))
            ->when($request->input('blood_type'), fn (Builder $q, array $types) => $q->whereIn('blood_type', $types))
            ->when($request->input('urgency'), fn (Builder $q, array $urgencies) => $q->whereIn('urgency', $urgencies))
            ->when($request->input('posted_after'), fn (Builder $q, string $date) => $q->whereDate('published_at', '>=', $date))
            ->when($request->input('posted_before'), fn (Builder $q, string $date) => $q->whereDate('published_at', '<=', $date))
            ->when($request->input('province'), fn (Builder $q, string $province) => $q->whereHas('municipality', fn (Builder $m) => $m->where('province', $province)))
            ->when($request->filled('q'), function (Builder $q) use ($request) {
                $term = '%'.str_replace(['%', '_'], ['\%', '\_'], (string) $request->input('q')).'%';
                $q->where(fn (Builder $w) => $w
                    ->where('public_id', 'ilike', $term)
                    ->orWhereHas('municipality', fn (Builder $m) => $m->where('name', 'ilike', $term)->orWhere('province', 'ilike', $term))
                    ->orWhereHas('coordinationPoint', fn (Builder $c) => $c->where('name', 'ilike', $term)));
            });

        match ($request->input('sort', '-updated_at')) {
            'urgency' => $query->orderByRaw(
                "CASE urgency WHEN 'within_24h' THEN 0 WHEN 'within_72h' THEN 1 ELSE 2 END"
            )->orderBy('expires_at'),
            'expires_at' => $query->orderBy('expires_at'),
            '-published_at' => $query->orderByDesc('published_at'),
            default => $query->orderByDesc('updated_at'),
        };
        $query->orderBy('id');

        return PublicRequestResource::collection($query->paginate(self::PER_PAGE)->withQueryString());
    }

    /**
     * GET /api/requests/{id}. Expired/closed stay resolvable (with a banner in
     * the UI); unpublished requests 404 unless the viewer owns or reviews them.
     */
    public function show(Request $request, BloodRequest $bloodRequest, BloodRequestPolicy $policy): JsonResource
    {
        $viewer = $request->user();
        abort_unless($policy->view($viewer, $bloodRequest), 404);

        $bloodRequest->load(['municipality', 'coordinationPoint', 'submitter', 'assignedCoordinator']);

        $managed = $viewer && ($policy->owns($viewer, $bloodRequest) || $policy->reviews($viewer, $bloodRequest));

        return $managed ? new ManagedRequestResource($bloodRequest) : new PublicRequestResource($bloodRequest);
    }

    /** GET /api/stats/public — aggregates only, cached 5 min (54:222). */
    public function stats(): JsonResponse
    {
        $stats = cache()->remember('stats.public', now()->addMinutes(5), function () {
            $live = BloodRequest::query()->publiclyListed();

            return [
                'active_requests' => (clone $live)->count(),
                'municipalities' => (clone $live)->distinct('municipality_id')->count('municipality_id'),
                'by_blood_type' => (clone $live)
                    ->select('blood_type', DB::raw('count(*) as total'))
                    ->groupBy('blood_type')
                    ->pluck('total', 'blood_type'),
                // Landing "Regional focus" area selector (21:3655).
                'by_province' => (clone $live)
                    ->join('municipalities', 'municipalities.id', '=', 'blood_requests.municipality_id')
                    ->select('municipalities.province', DB::raw('count(*) as total'))
                    ->groupBy('municipalities.province')
                    ->pluck('total', 'municipalities.province'),
                'is_demo' => (clone $live)->where('is_demo', true)->exists(),
            ];
        });

        return response()->json(['data' => $stats]);
    }
}
