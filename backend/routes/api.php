<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\Admin\AuditLogController;
use App\Http\Controllers\Api\Admin\RoleChangeController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\CoordinatorActivityController;
use App\Http\Controllers\Api\LookupController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PublicRequestController;
use App\Http\Controllers\Api\RequestController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\SavedRequestController;
use Illuminate\Support\Facades\Route;

/*
| API contracts: Figma 51:476 + docs/decisions.md (#1, #7–#10).
| Policies decide every action; resources decide every field.
*/

// ── Public ──────────────────────────────────────────────────────────────
Route::get('/requests', [PublicRequestController::class, 'index'])->middleware('throttle:public');
Route::get('/stats/public', [PublicRequestController::class, 'stats']);
Route::get('/municipalities', [LookupController::class, 'municipalities']);
Route::get('/coordination-points/public', [LookupController::class, 'publicCoordinationPoints']);

// ── Signed in ───────────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'account.active'])->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me/preferences', [MeController::class, 'updatePreferences']);
    Route::delete('/me', [MeController::class, 'destroy']);
    Route::patch('/me', [AccountController::class, 'update']);
    Route::put('/me/password', [AccountController::class, 'updatePassword']);
    Route::get('/me/sessions', [AccountController::class, 'sessions']);
    Route::delete('/me/sessions/{session}', [AccountController::class, 'destroySession']);
    Route::post('/me/deactivate', [AccountController::class, 'deactivate']);
    Route::get('/me/activity', [AccountController::class, 'activity']);
    Route::get('/me/export', [AccountController::class, 'export']);
    Route::get('/me/notifications', [LookupController::class, 'notifications']);
    Route::post('/me/notifications/read', [LookupController::class, 'markNotificationsRead']);

    Route::get('/me/saved-requests', [SavedRequestController::class, 'index']);
    Route::post('/me/saved-requests/{bloodRequest}', [SavedRequestController::class, 'store']);
    Route::delete('/me/saved-requests/{bloodRequest}', [SavedRequestController::class, 'destroy']);

    Route::get('/coordination-points', [LookupController::class, 'coordinationPoints']);

    // Submitter / owner
    Route::get('/requests/mine', [RequestController::class, 'mine']);
    Route::post('/requests', [RequestController::class, 'store']);
    Route::patch('/requests/{bloodRequest}', [RequestController::class, 'update']);
    Route::post('/requests/{bloodRequest}/submit', [RequestController::class, 'submit']);
    Route::post('/requests/{bloodRequest}/fulfill', [RequestController::class, 'fulfill']);
    Route::post('/requests/{bloodRequest}/close', [RequestController::class, 'close']);
    Route::post('/requests/{bloodRequest}/extend', [RequestController::class, 'extend']);
    Route::get('/requests/{bloodRequest}/history', [RequestController::class, 'history']);

    // Coordinator (area) / admin
    Route::middleware('role:coordinator,admin')->group(function () {
        Route::get('/coordinator/queue', [ReviewController::class, 'queue']);
        Route::get('/coordinator/summary', [ReviewController::class, 'summary']);
        Route::get('/coordinator/activity', [CoordinatorActivityController::class, 'index']);
        Route::get('/coordinator/activity/export', [CoordinatorActivityController::class, 'export']);
        Route::post('/requests/{bloodRequest}/assign', [ReviewController::class, 'assign']);
        Route::post('/requests/{bloodRequest}/approve', [ReviewController::class, 'approve']);
        Route::post('/requests/{bloodRequest}/request-correction', [ReviewController::class, 'requestCorrection']);
        Route::post('/requests/{bloodRequest}/reject', [ReviewController::class, 'reject']);
        Route::post('/requests/{bloodRequest}/reveal-contact', [ReviewController::class, 'revealContact']);
    });

    // Admin
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::patch('/users/{user}/role', [UserController::class, 'updateRole']);
        Route::post('/users/{user}/restrict', [UserController::class, 'restrict']);
        Route::post('/role-changes/{roleChange}/approve', [RoleChangeController::class, 'approve']);
        Route::post('/role-changes/{roleChange}/decline', [RoleChangeController::class, 'decline']);
        // Read-only: no update/delete routes exist (51:558).
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });
});

// Detail is public but reads the session when present (owner/reviewer view).
Route::get('/requests/{bloodRequest}', [PublicRequestController::class, 'show']);
