<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\BloodRequest;
use App\Models\User;
use App\Notifications\RequestUpdate;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** /api/me, saved requests, scheduled jobs and the audit log. */
class AccountAndSchedulerTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
    }

    public function test_me_exposes_permissions_that_drive_the_navigation(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();

        $this->actingAs(User::factory()->create())->getJson('/api/me')
            ->assertOk()->assertJsonPath('data.role', 'donor')->assertJsonPath('data.permissions', ['requests.save'])
            ->assertJsonPath('data.preferences.email_saved_status_changes', true);
        $this->actingAs($this->submitter)->getJson('/api/me')
            ->assertJsonPath('data.permissions', ['requests.save', 'requests.create', 'requests.own'])
            ->assertJsonPath('data.coordination_point.name', $this->point->name);
        $this->actingAs($this->coordinator())->getJson('/api/me')
            ->assertJsonPath('data.area.short_name', 'Negros Occ. (North)')
            ->assertJsonPath('data.permissions', ['requests.save', 'review.queue', 'review.activity']);
        $this->actingAs(User::factory()->admin()->create())->getJson('/api/me')
            ->assertJsonFragment(['admin.audit']);
    }

    public function test_preferences_update_instantly_and_reject_unknown_values(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson('/api/me/preferences', ['email_weekly_area_summary' => true])
            ->assertOk()->assertJsonPath('data.preferences.email_weekly_area_summary', true)
            ->assertJsonPath('data.preferences.email_expiry_reminder', true);
        $this->actingAs($user)->patchJson('/api/me/preferences', ['email_weekly_area_summary' => 'yes please'])->assertUnprocessable();
    }

    public function test_saving_is_idempotent_and_saved_items_survive_expiry(): void
    {
        $user = User::factory()->create();
        $request = $this->activeRequest();

        $this->postJson("/api/me/saved-requests/{$request->public_id}")->assertUnauthorized();
        $this->actingAs($user)->postJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent();
        $this->actingAs($user)->postJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent();
        $this->assertSame(1, $user->savedRequests()->count());

        $this->actingAs($user)->getJson("/api/requests/{$request->public_id}")->assertJsonPath('data.is_saved', true);

        $request->forceFill(['status' => RequestStatus::Expired])->save();
        $this->actingAs($user)->getJson('/api/me/saved-requests')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'expired');

        $this->actingAs($user)->deleteJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent();
        $this->actingAs($user)->deleteJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent();
        $this->assertSame(0, $user->savedRequests()->count());
    }

    public function test_unpublished_requests_cannot_be_saved(): void
    {
        $pending = BloodRequest::factory()->by($this->submitter)->pending()->create();

        $this->actingAs(User::factory()->create())->postJson("/api/me/saved-requests/{$pending->public_id}")->assertForbidden();
    }

    public function test_account_deletion_needs_the_typed_email_and_signs_out(): void
    {
        $user = User::factory()->create(['email' => 'juan.demo@example.org']);

        $this->actingAs($user)->deleteJson('/api/me', ['confirmation' => 'juan@example.org'])->assertUnprocessable();
        $this->actingAs($user)->deleteJson('/api/me', ['confirmation' => 'juan.demo@example.org'])->assertAccepted();

        $this->assertNotNull($user->fresh()->deletion_requested_at);
        $this->actingAs($user->fresh())->getJson('/api/me')->assertForbidden();
    }

    public function test_purge_removes_accounts_after_30_days(): void
    {
        $old = User::factory()->create(['deletion_requested_at' => now()->subDays(31)]);
        $recent = User::factory()->create(['deletion_requested_at' => now()->subDays(5)]);

        $this->artisan('users:purge-deleted')->assertSuccessful();

        $this->assertModelMissing($old);
        $this->assertModelExists($recent);
    }

    public function test_expiry_job_expires_notifies_owner_and_savers_and_audits(): void
    {
        Notification::fake();
        $due = $this->activeRequest(['expires_at' => now()->subMinute()]);
        $notYet = $this->activeRequest(['expires_at' => now()->addHour()]);
        $saver = User::factory()->create();
        $saver->savedRequests()->attach($due);

        $this->artisan('requests:expire')->assertSuccessful();

        $this->assertSame(RequestStatus::Expired, $due->fresh()->status);
        $this->assertSame(RequestStatus::Active, $notYet->fresh()->status);
        Notification::assertSentTo([$this->submitter, $saver], RequestUpdate::class, fn (RequestUpdate $n) => $n->kind === 'expired');
        $this->assertDatabaseHas('audit_logs', ['action' => 'request.expired', 'actor_id' => null, 'from' => 'active', 'to' => 'expired']);

        // Detail URL stays resolvable; public search no longer lists it.
        $this->getJson("/api/requests/{$due->public_id}")->assertOk()->assertJsonPath('data.status', 'expired');
        $this->getJson('/api/requests')->assertJsonMissing(['id' => $due->public_id]);
    }

    public function test_expiry_reminder_is_sent_once_six_hours_before(): void
    {
        Notification::fake();
        $soon = $this->activeRequest(['expires_at' => now()->addHours(5)]);
        $later = $this->activeRequest(['expires_at' => now()->addHours(10)]);
        $saver = User::factory()->create();
        $saver->savedRequests()->attach([$soon->getKey(), $later->getKey()]);

        $this->artisan('requests:remind-expiring')->assertSuccessful();
        $this->artisan('requests:remind-expiring')->assertSuccessful();

        Notification::assertSentToTimes($saver, RequestUpdate::class, 1);
        $this->assertNotNull($soon->fresh()->expiry_reminder_sent_at);
    }

    public function test_email_follows_preferences_for_savers_but_owners_always_get_it(): void
    {
        $request = $this->activeRequest();
        $optedOut = User::factory()->create(['preferences' => ['email_saved_status_changes' => false]]);
        $optedIn = User::factory()->create();

        $this->assertSame(['database'], (new RequestUpdate($request, 'status_changed'))->via($optedOut));
        $this->assertSame(['database', 'mail'], (new RequestUpdate($request, 'status_changed'))->via($optedIn));
        $this->assertSame(['database', 'mail'], (new RequestUpdate($request, 'expired'))->via($this->submitter));
    }

    public function test_audit_log_is_insert_only_at_the_database(): void
    {
        $log = AuditLog::query()->create(['action' => 'test', 'target_type' => 'x']);

        $this->expectException(QueryException::class);
        DB::table('audit_logs')->where('id', $log->getKey())->update(['action' => 'tampered']);
    }

    public function test_audit_log_model_refuses_deletes(): void
    {
        $log = AuditLog::query()->create(['action' => 'test', 'target_type' => 'x']);

        $this->expectException(\LogicException::class);
        $log->delete();
    }

    public function test_audit_log_is_admin_only_filterable_and_exports_csv(): void
    {
        $request = $this->activeRequest();
        $coordinator = $this->coordinator();
        $this->actingAs($coordinator)->postJson("/api/requests/{$request->public_id}/fulfill");

        $this->actingAs($coordinator)->getJson('/api/admin/audit-logs')->assertForbidden();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->getJson('/api/admin/audit-logs?action=request.fulfilled')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.target', $request->public_id);

        $csv = $this->actingAs($admin)->get('/api/admin/audit-logs?format=csv');
        $csv->assertOk();
        $body = $csv->streamedContent();
        $this->assertStringContainsString('request.fulfilled', $body);
        $this->assertStringNotContainsString('0917', $body);
        $this->assertStringNotContainsString('@', $body);
    }

    public function test_activity_records_saves_preferences_and_sign_ins(): void
    {
        $request = $this->activeRequest();
        $donor = User::factory()->create(['password' => 'Correct-horse-9']);

        $this->withHeader('User-Agent', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36')
            ->postJson('/login', ['email' => $donor->email, 'password' => 'Correct-horse-9'])->assertOk();
        $this->postJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent();
        $this->postJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent(); // idempotent, logged once
        $this->deleteJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent();
        $this->patchJson('/api/me/preferences', ['email_expiry_reminder' => true])->assertOk();

        $activity = $this->getJson('/api/me/activity')->assertOk()->json('data');
        $this->assertSame(
            ['account.preferences_updated', 'request.unsaved', 'request.saved', 'account.signed_in'],
            array_column($activity, 'action'),
        );
        $this->assertSame('Chrome · Android', $activity[3]['device']);
        $this->assertSame($request->public_id, $activity[2]['request']);
        $this->assertSame('active', $activity[2]['request_status']);
        $this->assertSame(['email_expiry_reminder' => true], $activity[0]['changes']);
    }
}
