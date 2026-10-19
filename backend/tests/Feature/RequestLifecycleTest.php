<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\BloodRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Request lifecycle (33:1787) and its edge cases (55:303). */
class RequestLifecycleTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
        Notification::fake();
    }

    /** @return array<string, mixed> */
    private function draftPayload(array $overrides = []): array
    {
        return [
            'blood_type' => 'O+',
            'units_requested' => 2,
            'needed_by' => now('Asia/Manila')->addDays(2)->toDateString(),
            'desk_window_start' => '08:00',
            'desk_window_end' => '17:00',
            'municipality_id' => $this->municipality->getKey(),
            'category' => 'scheduled_procedure',
            'public_summary' => '2 units requested for a scheduled procedure.',
            'contact_method' => 'desk_phone',
            'contact_visible_to' => 'signed_in',
            ...$overrides,
        ];
    }

    private function submittedRequest(array $overrides = []): BloodRequest
    {
        $id = $this->actingAs($this->submitter)->postJson('/api/requests', $this->draftPayload($overrides))->json('data.id');
        $this->actingAs($this->submitter)->postJson("/api/requests/{$id}/submit")->assertOk();

        return BloodRequest::query()->where('public_id', $id)->firstOrFail();
    }

    public function test_submitter_creates_a_draft_for_their_own_desk_only(): void
    {
        $response = $this->actingAs($this->submitter)->postJson('/api/requests', $this->draftPayload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.coordination_point.id', $this->point->getKey());
        $this->assertMatchesRegularExpression('/^BM-\d{4}-\d{4}$/', $response->json('data.id'));

        $this->actingAs($this->submitter)
            ->postJson('/api/requests', $this->draftPayload(['coordination_point_id' => $this->point->getKey() + 999]))
            ->assertUnprocessable()->assertJsonValidationErrors('coordination_point_id');
    }

    public function test_donors_and_coordinators_cannot_create_requests(): void
    {
        $this->postJson('/api/requests', $this->draftPayload())->assertUnauthorized();
        $this->actingAs(User::factory()->create())->postJson('/api/requests', $this->draftPayload())->assertForbidden();
        $this->actingAs($this->coordinator())->postJson('/api/requests', $this->draftPayload())->assertForbidden();
    }

    public function test_needed_by_cannot_be_in_the_past(): void
    {
        $this->actingAs($this->submitter)
            ->postJson('/api/requests', $this->draftPayload(['needed_by' => now()->subDays(2)->toDateString()]))
            ->assertUnprocessable()->assertJsonValidationErrors('needed_by');
    }

    public function test_submit_moves_to_review_derives_urgency_and_runs_checks(): void
    {
        $request = $this->submittedRequest([
            'needed_by' => now('Asia/Manila')->addDay()->toDateString(),
            'public_summary' => 'Patient: Maria Santos. Call 0917 123 4567.',
        ]);

        $this->assertSame(RequestStatus::PendingReview, $request->status);
        $this->assertContains($request->urgency->value, ['within_24h', 'within_72h']);
        $this->assertEqualsCanonicalizing(['possible_phone_number', 'possible_personal_name'], $request->screening_flags);
        $this->assertNotNull($request->first_submitted_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.submitted', 'target_id' => $request->getKey(), 'to' => 'pending_review']);

        // Pending requests never appear publicly.
        $this->getJson('/api/requests')->assertJsonCount(0, 'data');
    }

    public function test_duplicate_submissions_are_flagged_for_the_coordinator(): void
    {
        $this->submittedRequest();
        $second = $this->submittedRequest();

        $this->assertTrue($second->possible_duplicate);
    }

    public function test_coordinator_approves_and_the_request_goes_live_until_the_desk_window_closes(): void
    {
        $request = $this->submittedRequest(['needed_by' => '2099-01-15', 'desk_window_end' => '17:00']);
        $coordinator = $this->coordinator();

        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            // 17:00 Asia/Manila = 09:00 UTC (31:899).
            ->assertJsonPath('data.expires_at', '2099-01-15T09:00:00Z');

        $this->getJson('/api/requests')->assertJsonPath('data.0.id', $request->public_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.approved', 'actor_id' => $coordinator->getKey(), 'from' => 'pending_review', 'to' => 'active']);
    }

    public function test_coordinators_only_review_inside_their_area(): void
    {
        $request = $this->submittedRequest();
        $outsider = User::factory()->coordinator()->create();

        $this->actingAs($outsider)->postJson("/api/requests/{$request->public_id}/approve")->assertForbidden();
        $this->actingAs(User::factory()->create())->postJson("/api/requests/{$request->public_id}/approve")->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->postJson("/api/requests/{$request->public_id}/approve")->assertOk();
    }

    public function test_actions_on_a_request_assigned_elsewhere_are_409(): void
    {
        $request = $this->submittedRequest();
        $maria = $this->coordinator();
        $other = $this->coordinator();

        $this->actingAs($maria)->postJson("/api/requests/{$request->public_id}/assign")
            ->assertOk()->assertJsonPath('data.assigned_coordinator.is_me', true);
        $this->actingAs($other)->postJson("/api/requests/{$request->public_id}/approve")->assertConflict();
        $this->actingAs($other)->postJson("/api/requests/{$request->public_id}/reject", ['reason' => 'Duplicate'])->assertConflict();
    }

    public function test_correction_requires_a_note_and_resubmission_keeps_the_queue_position(): void
    {
        $request = $this->submittedRequest();
        $coordinator = $this->coordinator();
        $firstSubmitted = $request->first_submitted_at;

        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/request-correction")
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/request-correction", ['reason' => 'Add the desk hours.'])
            ->assertOk()->assertJsonPath('data.status', 'needs_correction')->assertJsonPath('data.correction_note', 'Add the desk hours.');

        $this->travel(2)->hours();
        $this->actingAs($this->submitter)->patchJson("/api/requests/{$request->public_id}", ['public_summary' => 'Updated summary.'])->assertOk();
        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/submit")
            ->assertOk()->assertJsonPath('data.status', 'pending_review');

        $this->assertTrue($request->fresh()->first_submitted_at->equalTo($firstSubmitted));
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.resubmitted', 'target_id' => $request->getKey()]);
    }

    public function test_rejected_requests_never_reopen(): void
    {
        $request = $this->submittedRequest();
        $coordinator = $this->coordinator();

        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/reject")->assertUnprocessable();
        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/reject", ['reason' => 'Not an authorized request.'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');

        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/approve")->assertConflict();
        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/submit")->assertForbidden();
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.rejected', 'reason' => 'Not an authorized request.']);
    }

    public function test_close_needs_a_reason_and_is_terminal(): void
    {
        $request = $this->activeRequest();

        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/close")->assertUnprocessable();
        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/close", ['reason' => 'Need met.'])
            ->assertOk()->assertJsonPath('data.status', 'closed');

        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/fulfill")->assertForbidden();
        $this->getJson('/api/requests')->assertJsonCount(0, 'data');
    }

    public function test_owner_or_coordinator_can_fulfill_but_not_a_stranger(): void
    {
        $request = $this->activeRequest();

        $this->actingAs(User::factory()->create())->postJson("/api/requests/{$request->public_id}/fulfill")->assertForbidden();
        $this->actingAs($this->coordinator())->postJson("/api/requests/{$request->public_id}/fulfill")
            ->assertOk()->assertJsonPath('data.status', 'fulfilled');
    }

    public function test_extend_is_at_most_72_hours_and_once_per_approval(): void
    {
        $request = $this->activeRequest(['expires_at' => now()->addDay()]);
        $before = $request->expires_at;

        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/extend", ['hours' => 73])->assertUnprocessable();
        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/extend")->assertOk();
        $this->assertSame(72, (int) $before->diffInHours($request->fresh()->expires_at));

        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/extend")->assertForbidden();
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.extended', 'target_id' => $request->getKey()]);
    }

    public function test_material_edits_send_a_live_request_back_to_review(): void
    {
        $request = $this->activeRequest(['blood_type' => 'O+']);

        $this->actingAs($this->submitter)->patchJson("/api/requests/{$request->public_id}", ['blood_type' => 'A+'])
            ->assertOk()->assertJsonPath('data.status', 'pending_review');
        $this->getJson('/api/requests')->assertJsonCount(0, 'data');
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.edited_material', 'from' => 'active', 'to' => 'pending_review']);
    }

    public function test_non_material_edits_update_in_place_and_are_logged(): void
    {
        $request = $this->activeRequest();

        $this->actingAs($this->submitter)->patchJson("/api/requests/{$request->public_id}", ['response_instructions' => 'Ask for the duty nurse.'])
            ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.response_instructions', 'Ask for the duty nurse.');
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.edited', 'target_id' => $request->getKey()]);
    }

    public function test_queue_tabs_and_counts(): void
    {
        $mine = $this->submittedRequest();
        $this->submittedRequest(['blood_type' => 'A+']);
        $coordinator = $this->coordinator();
        $this->actingAs($coordinator)->postJson("/api/requests/{$mine->public_id}/assign");

        $this->actingAs($coordinator)->getJson('/api/coordinator/queue?tab=mine')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.submitter.reference', $this->submitter->reference)
            ->assertJsonPath('counts', ['unassigned' => 1, 'mine' => 1, 'needs_correction' => 0, 'all_open' => 2, 'active' => 0, 'closed' => 0]);

        $this->actingAs(User::factory()->create())->getJson('/api/coordinator/queue')->assertForbidden();
        $this->actingAs(User::factory()->coordinator()->create())->getJson('/api/coordinator/queue')->assertJsonCount(0, 'data');
    }

    public function test_history_is_for_the_owner_and_reviewers_and_folds_correction_edits(): void
    {
        $request = $this->submittedRequest();
        $coordinator = $this->coordinator();
        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/request-correction", ['reason' => 'Add the desk hours.'])->assertOk();
        $this->actingAs($this->submitter)->patchJson("/api/requests/{$request->public_id}", ['desk_window_start' => '09:00'])->assertOk();
        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/submit")->assertOk();
        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/approve")->assertOk();
        $donor = User::factory()->create();
        $this->actingAs($donor)->postJson("/api/me/saved-requests/{$request->public_id}")->assertSuccessful();

        $history = $this->actingAs($this->submitter)->getJson("/api/requests/{$request->public_id}/history")->assertOk();
        $this->assertSame(
            ['request.created', 'request.submitted', 'request.correction_requested', 'request.resubmitted', 'request.approved'],
            array_column($history->json('data'), 'action'),
        );
        $history->assertJsonPath('data.0.actor.is_me', true)
            ->assertJsonPath('data.2.reason', 'Add the desk hours.')
            ->assertJsonPath('data.2.actor.name', $coordinator->name)
            ->assertJsonPath('data.3.fields', ['desk_window_start']);

        $this->actingAs($coordinator)->getJson("/api/requests/{$request->public_id}/history")->assertOk();
        $this->actingAs($donor)->getJson("/api/requests/{$request->public_id}/history")->assertNotFound();
    }

    public function test_owner_sees_a_live_privacy_review_of_the_public_text(): void
    {
        $id = $this->actingAs($this->submitter)
            ->postJson('/api/requests', $this->draftPayload(['public_summary' => 'Call 0917 123 4567 for Mr. Santos.']))
            ->assertCreated()
            ->assertJsonPath('data.privacy_review.flags', ['possible_phone_number', 'possible_personal_name'])
            ->assertJsonPath('data.municipality_id', $this->municipality->getKey())
            ->json('data.id');

        $this->actingAs($this->coordinator())->getJson("/api/requests/{$id}")->assertJsonMissingPath('data.privacy_review');
    }

    public function test_my_requests_filters_tabs_and_counts(): void
    {
        $this->actingAs($this->submitter)->postJson('/api/requests', $this->draftPayload(['blood_type' => 'A-']))->assertCreated();
        $this->submittedRequest();
        $active = $this->activeRequest();
        $this->actingAs($this->submitter)->postJson("/api/requests/{$active->public_id}/fulfill")->assertOk();
        BloodRequest::factory()->by(User::factory()->create())->active()->create(); // someone else's

        $this->actingAs($this->submitter)->getJson('/api/requests/mine')
            ->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.counts', ['all' => 3, 'needs_action' => 1, 'active' => 1, 'closed' => 1, 'draft' => 1]);
        $this->actingAs($this->submitter)->getJson('/api/requests/mine?tab=closed')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'fulfilled');
        $this->actingAs($this->submitter)->getJson('/api/requests/mine?blood_type=A-')
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.counts.all', 1);
        $this->actingAs($this->submitter)->getJson('/api/requests/mine?q='.urlencode($active->public_id))
            ->assertJsonCount(1, 'data');
        $this->actingAs($this->submitter)->getJson('/api/requests/mine?q='.urlencode($this->municipality->name))
            ->assertJsonCount(3, 'data');
        $this->actingAs($this->submitter)->getJson('/api/requests/mine?created_after='.now('Asia/Manila')->addDay()->toDateString())
            ->assertJsonCount(0, 'data');
    }

    public function test_public_ids_skip_ids_already_taken_by_seeded_requests(): void
    {
        $probe = (int) $this->activeRequest()->getKey();
        // Next row gets $probe + 1 and claims the ID the row after it would get.
        $this->activeRequest(['public_id' => sprintf('BM-%d-%04d', now()->year, $probe + 2)]);

        $id = $this->actingAs($this->submitter)->postJson('/api/requests', $this->draftPayload())->assertCreated()->json('data.id');

        $this->assertSame(sprintf('BM-%d-%04d', now()->year, $probe + 3), $id);
    }

    public function test_saving_unchanged_desk_times_is_not_an_edit(): void
    {
        $request = $this->activeRequest(['desk_window_start' => '08:00', 'desk_window_end' => '17:00']);

        $this->actingAs($this->submitter)->patchJson("/api/requests/{$request->public_id}", ['desk_window_start' => '08:00', 'desk_window_end' => '17:00'])
            ->assertOk()->assertJsonPath('data.desk_window', ['08:00', '17:00']);

        $this->assertDatabaseMissing('audit_logs', ['action' => 'request.edited', 'target_id' => $request->getKey()]);
    }
}
