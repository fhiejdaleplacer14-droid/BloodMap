<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\CoordinationPoint;
use App\Models\Municipality;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Reference data for forms and filters. */
class LookupController extends Controller
{
    /** GET /api/municipalities — province / city selects and the Explorer "Area" filter. */
    public function municipalities(): JsonResponse
    {
        $municipalities = cache()->remember('lookup.municipalities', now()->addHour(), fn () => Municipality::query()
            ->with('area:id,name,short_name')
            ->orderBy('province')
            ->orderBy('name')
            ->get()
            ->map(fn (Municipality $m) => [
                'id' => $m->getKey(),
                'name' => $m->name,
                'province' => $m->province,
                'area' => $m->area->only(['id', 'name', 'short_name']),
                // Centroid only — the same generalized point requests use.
                'point' => [$m->centroid_lng, $m->centroid_lat],
            ]));

        return response()->json(['data' => $municipalities]);
    }

    /**
     * GET /api/coordination-points/public — facility markers on the public
     * map. Desks are public institutions shown at their published location
     * (55:249, decision #6); never a phone, email or anything about a request.
     */
    public function publicCoordinationPoints(): JsonResponse
    {
        $points = cache()->remember('lookup.coordination-points.public', now()->addMinutes(10), fn () => CoordinationPoint::query()
            ->with('municipality:id,name,province')
            ->orderBy('name')
            ->get()
            ->map(fn (CoordinationPoint $p) => [
                'id' => $p->getKey(),
                'name' => $p->name,
                'municipality' => $p->municipality->name,
                'province' => $p->municipality->province,
                'point' => [$p->lng, $p->lat],
                'is_demo' => $p->is_demo,
            ]));

        return response()->json(['data' => $points]);
    }

    /**
     * GET /api/coordination-points — the points the user may submit for
     * (submitters: their one authorized desk; coordinators/admins: all).
     */
    public function coordinationPoints(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $points = CoordinationPoint::query()
            ->with('municipality:id,name,province')
            ->when($user->role === Role::FacilitySubmitter, fn ($q) => $q->whereKey($user->coordination_point_id))
            ->when($user->role === Role::Coordinator, fn ($q) => $q->whereHas('municipality', fn ($m) => $m->where('area_id', $user->area_id)))
            ->when($user->role === Role::Donor, fn ($q) => $q->whereRaw('false'))
            ->orderBy('name')
            ->get()
            ->map(fn (CoordinationPoint $p) => [
                'id' => $p->getKey(),
                'name' => $p->name,
                'hours' => $p->hours,
                'municipality' => $p->municipality->only(['id', 'name', 'province']),
                'has_phone' => filled($p->phone),
                'has_email' => filled($p->email),
                'is_demo' => $p->is_demo,
            ]);

        return response()->json(['data' => $points]);
    }

    /** GET /api/me/notifications — in-app updates (Donor dashboard, 44:823). */
    public function notifications(Request $request): JsonResponse
    {
        $page = $request->user()->notifications()->latest()->paginate(20);

        return response()->json([
            'data' => $page->getCollection()->map(fn ($n) => [
                'id' => $n->id,
                ...$n->data,
                'read' => $n->read_at !== null,
                'created_at' => $n->created_at?->toIso8601ZuluString(),
            ]),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'unread' => $request->user()->unreadNotifications()->count(),
            ],
        ]);
    }

    /** POST /api/me/notifications/read — mark all as read. */
    public function markNotificationsRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['message' => 'All caught up.']);
    }
}
