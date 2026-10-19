<?php

namespace Tests\Feature;

use App\Enums\ContactMethod;
use App\Enums\ContactVisibility;
use App\Enums\RequestStatus;
use App\Models\BloodRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Public search & detail: privacy is enforced on the server (51:578 · 55:248). */
class PublicRequestsTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
    }

    public function test_lists_only_live_requests(): void
    {
        $live = $this->activeRequest();
        BloodRequest::factory()->by($this->submitter)->pending()->create();
        BloodRequest::factory()->by($this->submitter)->expired()->create();
        $this->activeRequest(['paused_at' => now()]);

        $this->getJson('/api/requests')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $live->public_id)
            ->assertJsonPath('meta.per_page', 30);
    }

    public function test_location_is_the_municipality_centroid_only(): void
    {
        $this->activeRequest();

        $response = $this->getJson('/api/requests')->assertOk();

        $response->assertJsonPath('data.0.location', [
            'municipality' => 'San Carlos City',
            'province' => 'Negros Occidental',
            'point' => [123.42, 10.48],
            'precision' => 'municipality',
        ]);
        $json = $response->getContent();
        // The desk's own coordinates and any address-like fields never appear.
        $this->assertStringNotContainsString('10.4931', $json);
        $this->assertStringNotContainsString('123.4187', $json);
        foreach (['address', 'street', '"lat"', '"lng"', 'submitter', 'screening_flags'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $json);
        }
    }

    public function test_filters_by_bbox_blood_type_and_urgency(): void
    {
        $this->activeRequest(['blood_type' => 'O+', 'urgency' => 'within_24h']);
        $this->activeRequest(['blood_type' => 'A-', 'urgency' => 'scheduled']);

        $this->getJson('/api/requests?bbox=123.0,10.0,123.6,10.9')->assertJsonCount(2, 'data');
        $this->getJson('/api/requests?bbox=122.0,9.0,122.5,9.5')->assertJsonCount(0, 'data');
        $this->getJson('/api/requests?blood_type[]=O%2B')->assertJsonCount(1, 'data')->assertJsonPath('data.0.blood_type', 'O+');
        $this->getJson('/api/requests?urgency[]=within_24h')->assertJsonCount(1, 'data');
        $this->getJson('/api/requests?q=san%20carlos')->assertJsonCount(2, 'data');
    }

    public function test_status_province_and_posted_range_filters(): void
    {
        $this->activeRequest(['published_at' => now()->subDays(10)]);
        $recent = $this->activeRequest(['published_at' => now()->subDay()]);
        BloodRequest::factory()->by($this->submitter)->active()->create(['status' => RequestStatus::Fulfilled]);
        $oldFulfilled = BloodRequest::factory()->by($this->submitter)->active()->create(['status' => RequestStatus::Fulfilled]);
        $oldFulfilled->forceFill(['updated_at' => now()->subDays(8)])->saveQuietly();

        // "Recently fulfilled" = fulfilled within 7 days; active stays the default.
        $this->getJson('/api/requests')->assertJsonCount(2, 'data');
        $this->getJson('/api/requests?status[]=fulfilled')->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'fulfilled');
        $this->getJson('/api/requests?status[]=active&status[]=fulfilled')->assertJsonCount(3, 'data');
        $this->getJson('/api/requests?status=active')->assertJsonCount(2, 'data');

        $this->getJson('/api/requests?province=Negros%20Occidental')->assertJsonCount(2, 'data');
        $this->getJson('/api/requests?province=Siquijor')->assertJsonCount(0, 'data');

        $from = now()->subDays(3)->toDateString();
        $to = now()->toDateString();
        $this->getJson("/api/requests?posted_after={$from}&posted_before={$to}")
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $recent->public_id);
    }

    public function test_invalid_filters_are_422(): void
    {
        $this->getJson('/api/requests?blood_type[]=Z%2B')->assertUnprocessable()->assertJsonValidationErrors('blood_type.0');
        $this->getJson('/api/requests?bbox=200,0,1,1')->assertUnprocessable()->assertJsonValidationErrors('bbox');
        $this->getJson('/api/requests?status=draft')->assertUnprocessable();
        $this->getJson('/api/requests?urgency[]=critical')->assertUnprocessable();
        $this->getJson('/api/requests?province=Cebu')->assertUnprocessable();
        // "To must be on or after From" (19:3185) and no future dates.
        $this->getJson('/api/requests?posted_after=2026-10-12&posted_before=2026-10-10')->assertUnprocessable()->assertJsonValidationErrors('posted_before');
        $this->getJson('/api/requests?posted_before='.now()->addDays(2)->toDateString())->assertUnprocessable();
    }

    public function test_unpublished_requests_are_404_to_the_public(): void
    {
        $pending = BloodRequest::factory()->by($this->submitter)->pending()->create();

        $this->getJson("/api/requests/{$pending->public_id}")->assertNotFound();
        $this->actingAs(User::factory()->create())->getJson("/api/requests/{$pending->public_id}")->assertNotFound();
        $this->actingAs($this->submitter)->getJson("/api/requests/{$pending->public_id}")->assertOk();
    }

    public function test_expired_detail_stays_resolvable_without_contact(): void
    {
        $expired = BloodRequest::factory()->by($this->submitter)->expired()->create(['contact_visible_to' => ContactVisibility::Public]);

        $this->getJson("/api/requests/{$expired->public_id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'expired')
            ->assertJsonPath('data.contact', null);
    }

    public function test_contact_is_gated_by_visibility(): void
    {
        $signedIn = $this->activeRequest(['contact_visible_to' => ContactVisibility::SignedIn]);
        $public = $this->activeRequest(['contact_visible_to' => ContactVisibility::Public]);
        $coordinatorsOnly = $this->activeRequest(['contact_visible_to' => ContactVisibility::Coordinators]);
        $none = $this->activeRequest(['contact_method' => ContactMethod::None, 'contact_visible_to' => ContactVisibility::Public]);
        $donor = User::factory()->create();

        $this->getJson("/api/requests/{$signedIn->public_id}")->assertJsonPath('data.contact', null);
        $this->getJson("/api/requests/{$public->public_id}")->assertJsonPath('data.contact.value', '0917 555 0101');
        $this->getJson("/api/requests/{$none->public_id}")->assertJsonPath('data.contact', null);

        $this->actingAs($donor)->getJson("/api/requests/{$signedIn->public_id}")->assertJsonPath('data.contact.value', '0917 555 0101');
        $this->actingAs($donor)->getJson("/api/requests/{$coordinatorsOnly->public_id}")->assertJsonPath('data.contact', null);
    }

    public function test_coordinators_see_a_masked_contact_until_an_audited_reveal(): void
    {
        $request = $this->activeRequest(['contact_visible_to' => ContactVisibility::Coordinators]);
        $coordinator = $this->coordinator();

        $this->actingAs($coordinator)->getJson("/api/requests/{$request->public_id}")
            ->assertJsonPath('data.contact', ['method' => 'phone', 'value' => '09•• ••• ••••', 'masked' => true])
            ->assertJsonPath('data.can.reveal_contact', true);

        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/reveal-contact")
            ->assertOk()->assertJsonPath('data.value', '0917 555 0101');

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $coordinator->getKey(), 'action' => 'request.contact_revealed', 'target_id' => $request->getKey(),
        ]);
    }

    public function test_coordinators_outside_the_area_cannot_reveal(): void
    {
        $request = $this->activeRequest();
        $outsider = User::factory()->coordinator()->create();

        $this->actingAs($outsider)->postJson("/api/requests/{$request->public_id}/reveal-contact")->assertForbidden();
    }

    public function test_demo_flag_and_stats(): void
    {
        $this->activeRequest(['blood_type' => 'O+']);
        $this->activeRequest(['blood_type' => 'O+']);

        $this->getJson('/api/requests')->assertJsonPath('data.0.is_demo', true);
        $this->getJson('/api/stats/public')
            ->assertOk()
            ->assertJsonPath('data.active_requests', 2)
            ->assertJsonPath('data.by_blood_type.O+', 2)
            ->assertJsonPath('data.by_province.Negros Occidental', 2)
            ->assertJsonPath('data.is_demo', true);
    }

    public function test_public_coordination_points_carry_no_contact_details(): void
    {
        $response = $this->getJson('/api/coordination-points/public')->assertOk();

        $response->assertJsonPath('data.0.municipality', 'San Carlos City')
            ->assertJsonPath('data.0.province', 'Negros Occidental');
        $this->assertCount(2, $response->json('data.0.point'));
        $json = $response->getContent();
        foreach (['phone', 'email', '0917', 'hours'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $json);
        }
    }

    public function test_status_enum_values_match_the_contract(): void
    {
        $this->assertSame(
            ['draft', 'pending_review', 'needs_correction', 'active', 'fulfilled', 'closed', 'expired', 'rejected'],
            RequestStatus::values(),
        );
    }
}
