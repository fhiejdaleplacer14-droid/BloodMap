<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** "Report a problem" and the coordinator Reports list (decision #94). */
class ReportsTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
    }

    public function test_a_signed_in_visitor_reports_a_live_request_once(): void
    {
        $request = $this->activeRequest();
        $donor = User::factory()->create();

        $this->getJson("/api/requests/{$request->public_id}")->assertJsonPath('data.can.report', false);
        $this->actingAs($donor)->getJson("/api/requests/{$request->public_id}")->assertJsonPath('data.can.report', true);

        $this->actingAs($donor)->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'no_longer_needed'])
            ->assertCreated()->assertJsonPath('data.duplicate', false);
        $this->actingAs($donor)->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'wrong_details'])
            ->assertOk()->assertJsonPath('data.duplicate', true);

        $this->assertDatabaseCount('request_reports', 1);
        $this->assertTrue(AuditLog::query()->where('action', 'request.reported')->exists());

        // The owner never learns who reported it, or that anyone did; nor does the area feed.
        $history = $this->actingAs($this->submitter)->getJson("/api/requests/{$request->public_id}/history")->assertOk();
        $this->assertNotContains('request.reported', array_column($history->json('data'), 'action'));
        $activity = $this->actingAs($this->coordinator())->getJson('/api/coordinator/activity')->assertOk();
        $this->assertNotContains('request.reported', array_column($activity->json('data'), 'action'));
    }

    public function test_reports_are_validated_and_limited_to_live_requests_of_others(): void
    {
        $request = $this->activeRequest();
        $donor = User::factory()->create();

        $this->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'other'])->assertUnauthorized();
        $this->actingAs($donor)->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'other'])
            ->assertUnprocessable()->assertJsonValidationErrors('details');
        $this->actingAs($donor)->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'nope'])
            ->assertJsonValidationErrors('reason');
        // Owners can't report their own request.
        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'suspicious'])
            ->assertForbidden();

        $request->forceFill(['status' => 'closed'])->save();
        $this->actingAs($donor)->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'suspicious'])
            ->assertForbidden();
    }

    public function test_coordinators_triage_reports_in_their_area_only(): void
    {
        $request = $this->activeRequest();
        $donor = User::factory()->create();
        $this->actingAs($donor)->postJson("/api/requests/{$request->public_id}/reports", ['reason' => 'personal_information', 'details' => 'Shows a phone number.']);
        $coordinator = $this->coordinator();
        $elsewhere = $this->coordinator(Area::factory()->create());

        $this->actingAs($coordinator)->getJson('/api/coordinator/summary')->assertJsonPath('data.open_reports', 1);
        $list = $this->actingAs($coordinator)->getJson('/api/coordinator/reports')->assertOk()
            ->assertJsonPath('meta.counts.open', 1)
            ->assertJsonPath('data.0.request.id', $request->public_id)
            ->assertJsonPath('data.0.reason', 'personal_information')
            ->assertJsonPath('data.0.reporter', 'donor');
        $reportId = $list->json('data.0.id');

        $this->actingAs($elsewhere)->getJson('/api/coordinator/reports')->assertJsonPath('meta.counts.open', 0);
        $this->actingAs($elsewhere)->postJson("/api/coordinator/reports/{$reportId}/resolve", ['resolution' => 'dismissed'])->assertNotFound();

        $this->actingAs($coordinator)->postJson("/api/coordinator/reports/{$reportId}/resolve", ['resolution' => 'resolved', 'note' => 'Asked the desk to edit the summary.'])
            ->assertOk()->assertJsonPath('data.status', 'resolved')->assertJsonPath('data.resolved_by', 'you');
        $this->actingAs($coordinator)->postJson("/api/coordinator/reports/{$reportId}/resolve", ['resolution' => 'dismissed'])->assertConflict();

        $this->actingAs($coordinator)->getJson('/api/coordinator/reports?status=closed')->assertJsonPath('meta.counts.open', 0)->assertJsonCount(1, 'data');
        $this->assertTrue(AuditLog::query()->where('action', 'report.resolved')->where('reason', 'Asked the desk to edit the summary.')->exists());
        $this->actingAs($donor)->getJson('/api/coordinator/reports')->assertForbidden();
    }
}
