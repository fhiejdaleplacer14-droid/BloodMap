<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\BloodRequest;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Administration (09): overview, users, coordinators, audit filters and settings. */
class AdminWorkspaceTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
        Notification::fake();
        $this->admin = User::factory()->admin()->create();
    }

    public function test_overview_summary_covers_accounts_requests_and_coverage(): void
    {
        $this->actingAs($this->submitter)->postJson('/api/requests', [
            'blood_type' => 'O+', 'municipality_id' => $this->municipality->getKey(),
        ])->assertCreated();
        $this->activeRequest();
        $this->coordinator();

        $summary = $this->actingAs($this->admin)->getJson('/api/admin/summary?days=7')->assertOk();

        $summary->assertJsonPath('data.days', 7)
            ->assertJsonPath('data.active.total', 1)
            ->assertJsonPath('data.active.municipalities', 1)
            ->assertJsonCount(7, 'data.series')
            ->assertJsonPath('data.series.6.created', 1)
            ->assertJsonPath('data.municipalities.0.name', 'San Carlos City')
            ->assertJsonPath('data.municipalities.0.coordinators', 1)
            ->assertJsonPath('data.statuses.draft', 1);
        $this->assertGreaterThanOrEqual(3, $summary->json('data.accounts.total'));

        $this->actingAs($this->coordinator())->getJson('/api/admin/summary')->assertForbidden();
    }

    public function test_coordinator_list_flags_areas_nobody_covers(): void
    {
        $this->coordinator();
        Area::factory()->create(['name' => 'Siquijor']);

        $this->actingAs($this->admin)->getJson('/api/admin/coordinators')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.area.name', 'Negros Occidental (North)')
            ->assertJsonPath('meta.uncovered_areas.0.name', 'Siquijor');
    }

    public function test_user_details_reset_email_and_lifting_a_restriction(): void
    {
        $paused = BloodRequest::factory()->by($this->submitter)->active()->create();
        $this->actingAs($this->admin)->postJson("/api/admin/users/{$this->submitter->getKey()}/restrict", ['reason' => 'Spam reports'])->assertOk();
        $this->assertNotNull($paused->fresh()->paused_at);

        $this->actingAs($this->admin)->getJson("/api/admin/users/{$this->submitter->getKey()}")
            ->assertOk()
            ->assertJsonPath('data.status', 'restricted')
            ->assertJsonPath('data.restriction_reason', 'Spam reports')
            ->assertJsonMissingPath('data.password');

        $this->actingAs($this->admin)->postJson("/api/admin/users/{$this->submitter->getKey()}/unrestrict", ['reason' => 'Appeal accepted'])
            ->assertOk()->assertJsonPath('data.status', 'active');
        $this->assertNull($paused->fresh()->paused_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.unrestricted', 'reason' => 'Appeal accepted']);

        $this->actingAs($this->admin)->postJson("/api/admin/users/{$this->submitter->getKey()}/password-reset")->assertOk();
        Notification::assertSentTo($this->submitter, ResetPassword::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.password_reset_sent', 'target_id' => $this->submitter->getKey()]);
    }

    public function test_user_filters_and_csv_export(): void
    {
        User::factory()->unverified()->create(['name' => 'Rico Bautista']);

        $this->actingAs($this->admin)->getJson('/api/admin/users?status=unverified')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'unverified');

        $csv = $this->actingAs($this->admin)->get('/api/admin/users/export?role=facility_submitter')->assertOk()->streamedContent();
        $this->assertStringStartsWith('name,email,role,status', $csv);
        $this->assertStringContainsString($this->submitter->email, $csv);
        $this->assertStringNotContainsString('Rico Bautista', $csv);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.users_exported']);
    }

    public function test_audit_log_filters_by_resource_and_system_actor(): void
    {
        $this->actingAs($this->admin)->postJson("/api/admin/users/{$this->submitter->getKey()}/restrict", ['reason' => 'Spam reports']);
        $this->activeRequest(['expires_at' => now()->subMinute()]);
        $this->artisan('requests:expire')->assertSuccessful();

        $this->actingAs($this->admin)->getJson('/api/admin/audit-logs?resource=user')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'user.restricted')
            ->assertJsonPath('data.0.resource', 'user/'.$this->submitter->reference);
        $this->actingAs($this->admin)->getJson('/api/admin/audit-logs?actor=system')
            ->assertJsonPath('data.0.action', 'request.expired')
            ->assertJsonPath('data.0.actor', null);
    }

    public function test_settings_read_out_never_includes_secrets(): void
    {
        $settings = $this->actingAs($this->admin)->getJson('/api/admin/settings')->assertOk();

        $settings->assertJsonPath('data.expiry.max_extension_hours', 72)
            ->assertJsonPath('data.health.database.status', 'operational');
        $this->assertStringNotContainsString((string) config('app.key'), $settings->getContent());
    }
}
