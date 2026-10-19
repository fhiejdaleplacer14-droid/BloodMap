<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Area;
use App\Models\BloodRequest;
use App\Models\Municipality;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Coordinator workspace (08): overview summary, lists and the area activity log. */
class CoordinatorWorkspaceTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    private User $coordinator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
        Notification::fake();
        $this->coordinator = $this->coordinator();
    }

    private function submitted(array $overrides = []): BloodRequest
    {
        $id = $this->actingAs($this->submitter)->postJson('/api/requests', [
            'blood_type' => 'O+',
            'needed_by' => now('Asia/Manila')->addDays(2)->toDateString(),
            'municipality_id' => $this->municipality->getKey(),
            'public_summary' => '2 units requested for a scheduled procedure.',
            ...$overrides,
        ])->json('data.id');
        $this->actingAs($this->submitter)->postJson("/api/requests/{$id}/submit")->assertOk();

        return BloodRequest::query()->where('public_id', $id)->firstOrFail();
    }

    public function test_overview_summary_lists_review_work_and_this_weeks_decisions(): void
    {
        $approved = $this->submitted();
        $this->submitted(['blood_type' => 'A+']);
        $this->actingAs($this->coordinator)->postJson("/api/requests/{$approved->public_id}/approve")->assertOk();
        $this->activeRequest(['expires_at' => now()->addHours(5)]);

        $summary = $this->actingAs($this->coordinator)->getJson('/api/coordinator/summary')->assertOk();

        $summary->assertJsonPath('data.pending_review', 1)
            ->assertJsonPath('data.all_open', 1)
            ->assertJsonCount(1, 'data.needs_review')
            ->assertJsonPath('data.needs_review.0.blood_type', 'A+')
            ->assertJsonCount(1, 'data.expiring_soon')
            ->assertJsonPath('data.recently_updated.0.action', 'request.approved')
            ->assertJsonPath('data.recently_updated.0.by', 'you')
            ->assertJsonPath('data.recently_updated.1.by', 'owner')
            ->assertJsonCount(7, 'data.activity')
            ->assertJsonPath('data.activity.6.date', now('Asia/Manila')->toDateString())
            ->assertJsonPath('data.activity.6.approved', 1);
        $this->assertNotNull($summary->json('data.oldest_pending_at'));
    }

    public function test_active_and_closed_lists(): void
    {
        $this->activeRequest();
        $closed = $this->activeRequest();
        $this->actingAs($this->coordinator)->postJson("/api/requests/{$closed->public_id}/close", ['reason' => 'Need met.'])->assertOk();

        $this->actingAs($this->coordinator)->getJson('/api/coordinator/queue?tab=active')->assertJsonCount(1, 'data');
        $this->actingAs($this->coordinator)->getJson('/api/coordinator/queue?tab=closed')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'closed')
            ->assertJsonPath('counts.active', 1);
    }

    public function test_activity_log_is_scoped_to_the_area_filterable_and_hides_saves(): void
    {
        $request = $this->submitted();
        $this->actingAs($this->coordinator)->postJson("/api/requests/{$request->public_id}/request-correction", ['reason' => 'Add desk hours.']);
        $this->actingAs(User::factory()->create())->postJson("/api/me/saved-requests/{$this->activeRequest()->public_id}");

        $elsewhere = Municipality::factory()->create(['area_id' => Area::factory()->create()->getKey()]);
        BloodRequest::factory()->by($this->submitter)->active()->create(['municipality_id' => $elsewhere->getKey()])
            ->transitionTo(RequestStatus::Closed, $this->submitter, 'request.closed', 'Elsewhere.');

        $log = $this->actingAs($this->coordinator)->getJson('/api/coordinator/activity')->assertOk();
        $actions = array_column($log->json('data'), 'action');
        $this->assertSame(['request.correction_requested', 'request.submitted', 'request.created'], $actions);
        $log->assertJsonPath('data.0.reason', 'Add desk hours.')
            ->assertJsonPath('data.0.actor.name', $this->coordinator->name)
            ->assertJsonPath('meta.total', 3);

        $this->actingAs($this->coordinator)->getJson('/api/coordinator/activity?action=request.submitted')->assertJsonCount(1, 'data');
        $this->actingAs($this->coordinator)->getJson("/api/coordinator/activity?actor={$this->coordinator->getKey()}")->assertJsonCount(1, 'data');
        $this->actingAs($this->coordinator)->getJson('/api/coordinator/activity?target=NOPE')->assertJsonCount(0, 'data');

        $csv = $this->actingAs($this->coordinator)->get('/api/coordinator/activity/export')->assertOk();
        $this->assertStringStartsWith('timestamp,actor,action,target,outcome', $csv->streamedContent());
        $this->assertStringContainsString('request.correction_requested', $csv->streamedContent());

        $this->actingAs($this->submitter)->getJson('/api/coordinator/activity')->assertForbidden();
    }

    public function test_reviewers_see_the_submitters_track_record_in_history(): void
    {
        $request = $this->submitted();
        $this->actingAs($this->coordinator)->postJson("/api/requests/{$request->public_id}/request-correction", ['reason' => 'Add desk hours.']);
        $this->activeRequest();

        $this->actingAs($this->coordinator)->getJson("/api/requests/{$request->public_id}/history")
            ->assertJsonPath('meta.submitter', ['approved' => 1, 'corrections' => 1])
            ->assertJsonPath('data.0.actor.name', $this->submitter->reference);
        $this->actingAs($this->submitter)->getJson("/api/requests/{$request->public_id}/history")
            ->assertJsonMissingPath('meta.submitter');
    }
}
