<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicRequestResource;
use App\Models\BloodRequest;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Saved requests (51:505). Saving doesn't commit the donor to anything.
 * Saved requests that stop being active stay listed so the UI can group
 * them under "No longer active".
 */
class SavedRequestController extends Controller
{
    /** GET /api/me/saved-requests */
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        $saved = $user->savedRequests()
            ->whereIn('status', ['active', 'fulfilled', 'closed', 'expired'])
            // "Inactive requests stay here for 30 days … then they're removed" (28:856; System settings).
            ->where(fn ($q) => $q->where('status', 'active')->orWhere('blood_requests.updated_at', '>=', now()->subDays(Settings::int('retention.inactive_saved_days'))))
            ->with(['municipality', 'coordinationPoint'])
            ->orderByPivot('created_at', 'desc')
            ->get()
            ->each(fn (BloodRequest $r) => $r->setAttribute('is_saved_by_viewer', true));

        return PublicRequestResource::collection($saved);
    }

    /** POST /api/me/saved-requests/{id} — idempotent. */
    public function store(Request $request, BloodRequest $bloodRequest): Response
    {
        $this->authorize('save', $bloodRequest);
        $changes = $request->user()->savedRequests()->syncWithoutDetaching([$bloodRequest->getKey()]);
        if ($changes['attached'] !== []) {
            AuditLogger::record($request->user(), 'request.saved', $bloodRequest);
        }

        return response()->noContent();
    }

    /** DELETE /api/me/saved-requests/{id} — idempotent. */
    public function destroy(Request $request, BloodRequest $bloodRequest): Response
    {
        if ($request->user()->savedRequests()->detach($bloodRequest->getKey()) > 0) {
            AuditLogger::record($request->user(), 'request.unsaved', $bloodRequest);
        }

        return response()->noContent();
    }
}
