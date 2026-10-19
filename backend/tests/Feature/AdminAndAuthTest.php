<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Enums\Role;
use App\Models\BloodRequest;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Administration (09) and authentication (05). */
class AdminAndAuthTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
        // "Not a commonly used password" asks Have I Been Pwned; never call out in tests.
        Http::fake(['api.pwnedpasswords.com/*' => Http::response('', 200)]);
    }

    // ── Administration ─────────────────────────────────────────────────

    public function test_admin_endpoints_are_admin_only(): void
    {
        $this->actingAs($this->coordinator())->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->getJson('/api/admin/users')->assertOk();
    }

    public function test_role_change_needs_a_reason_and_is_audited(): void
    {
        $admin = User::factory()->admin()->create();
        $donor = User::factory()->create();

        $this->actingAs($admin)->patchJson("/api/admin/users/{$donor->id}/role", ['role' => 'coordinator', 'area_id' => $this->area->id])
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->actingAs($admin)->patchJson("/api/admin/users/{$donor->id}/role", ['role' => 'coordinator', 'reason' => 'x x x'])
            ->assertUnprocessable()->assertJsonValidationErrors('area_id');

        $this->actingAs($admin)->patchJson("/api/admin/users/{$donor->id}/role", [
            'role' => 'coordinator', 'area_id' => $this->area->id, 'reason' => 'Approved by NIR coordination lead',
        ])->assertOk()->assertJsonPath('data.role', 'coordinator')->assertJsonPath('data.area.id', $this->area->id);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.role_changed', 'actor_id' => $admin->id, 'from' => 'donor', 'to' => 'coordinator',
            'reason' => 'Approved by NIR coordination lead',
        ]);
    }

    public function test_submitters_get_a_reference_code(): void
    {
        $admin = User::factory()->admin()->create();
        $donor = User::factory()->create();

        $this->actingAs($admin)->patchJson("/api/admin/users/{$donor->id}/role", [
            'role' => 'facility_submitter', 'coordination_point_id' => $this->point->id, 'reason' => 'Desk staff',
        ])->assertOk()->assertJsonPath('data.reference', sprintf('S-%04d', $donor->id));
    }

    public function test_promotion_to_admin_needs_a_second_administrator(): void
    {
        $alex = User::factory()->admin()->create();
        $rosa = User::factory()->admin()->create();
        $maria = $this->coordinator();

        $response = $this->actingAs($alex)->patchJson("/api/admin/users/{$maria->id}/role", ['role' => 'admin', 'reason' => 'Needs admin access'])
            ->assertAccepted()->assertJsonPath('data.role', 'coordinator');
        $changeId = $response->json('data.pending_role_change.id');

        // The requester can't approve their own request.
        $this->actingAs($alex)->postJson("/api/admin/role-changes/{$changeId}/approve")->assertForbidden();
        $this->assertSame(Role::Coordinator, $maria->fresh()->role);

        $this->actingAs($rosa)->postJson("/api/admin/role-changes/{$changeId}/approve")
            ->assertOk()->assertJsonPath('data.role', 'admin')->assertJsonPath('data.area', null);
        $this->actingAs($rosa)->postJson("/api/admin/role-changes/{$changeId}/approve")->assertConflict();
    }

    public function test_admins_cannot_change_their_own_role(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->patchJson("/api/admin/users/{$admin->id}/role", ['role' => 'donor', 'reason' => 'oops'])->assertConflict();
    }

    public function test_restricting_revokes_sessions_and_pauses_requests(): void
    {
        $admin = User::factory()->admin()->create();
        $live = $this->activeRequest();
        DB::table('sessions')->insert(['id' => 'abc', 'user_id' => $this->submitter->id, 'payload' => '', 'last_activity' => time()]);

        $this->actingAs($admin)->postJson("/api/admin/users/{$this->submitter->id}/restrict")->assertUnprocessable();
        $this->actingAs($admin)->postJson("/api/admin/users/{$this->submitter->id}/restrict", ['reason' => 'Repeated misleading requests'])
            ->assertOk()->assertJsonPath('data.restricted', true);

        $this->assertDatabaseMissing('sessions', ['user_id' => $this->submitter->id]);
        // Paused, not deleted: gone from public search, still in the database.
        $this->assertNotNull($live->fresh()->paused_at);
        $this->assertSame(RequestStatus::Active, $live->fresh()->status);
        $this->getJson('/api/requests')->assertJsonCount(0, 'data');

        // A live session elsewhere loses access immediately.
        $this->actingAs($this->submitter->fresh())->getJson('/api/me')->assertForbidden()->assertJsonPath('code', 'account_restricted');
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.restricted', 'reason' => 'Repeated misleading requests']);
    }

    public function test_user_list_filters(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Alex Admin']);
        User::factory()->create(['name' => 'Juan Demo']);

        $this->actingAs($admin)->getJson('/api/admin/users?q=juan')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Juan Demo');
        $this->actingAs($admin)->getJson('/api/admin/users?role=facility_submitter')->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/admin/users')->assertJsonMissingPath('data.0.password');
    }

    // ── Authentication ─────────────────────────────────────────────────

    public function test_login_uses_one_generic_error_and_never_reveals_accounts(): void
    {
        $user = User::factory()->create(['email' => 'juan.demo@example.org']);

        $wrongPassword = $this->postJson('/login', ['email' => 'juan.demo@example.org', 'password' => 'nope'])->assertUnprocessable();
        $noAccount = $this->postJson('/login', ['email' => 'nobody@example.org', 'password' => 'nope'])->assertUnprocessable();
        $this->assertSame($wrongPassword->json('errors.email'), $noAccount->json('errors.email'));
        $this->assertSame(['Email or password is incorrect'], $noAccount->json('errors.email'));

        $this->postJson('/login', ['email' => 'juan.demo@example.org', 'password' => 'password'])
            ->assertOk()->assertJsonPath('data.email', $user->email)->assertJsonPath('data.permissions', ['requests.save']);
    }

    public function test_login_locks_after_five_failures_for_15_minutes(): void
    {
        User::factory()->create(['email' => 'juan.demo@example.org']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/login', ['email' => 'juan.demo@example.org', 'password' => 'wrong'])->assertUnprocessable();
        }
        // Even the right password is refused while locked.
        $this->postJson('/login', ['email' => 'juan.demo@example.org', 'password' => 'password'])
            ->assertTooManyRequests()->assertJsonPath('code', 'locked_out');

        $this->travel(16)->minutes();
        $this->postJson('/login', ['email' => 'juan.demo@example.org', 'password' => 'password'])->assertOk();
    }

    public function test_restricted_accounts_get_a_neutral_message(): void
    {
        User::factory()->restricted()->create(['email' => 'r@example.org']);

        $this->postJson('/login', ['email' => 'r@example.org', 'password' => 'password'])
            ->assertForbidden()->assertJsonPath('code', 'account_restricted');
        $this->assertGuest();
    }

    public function test_register_requires_consent_and_a_strong_password_then_sends_verification(): void
    {
        Notification::fake();
        $base = ['name' => 'Juan Demo', 'email' => 'new@example.org', 'password' => 'Correct-horse-12', 'password_confirmation' => 'Correct-horse-12'];

        $this->postJson('/register', $base)->assertUnprocessable()
            ->assertJsonPath('errors.terms.0', 'You need to accept to create an account.');
        $this->postJson('/register', [...$base, 'terms' => true, 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/register', [...$base, 'terms' => true, 'password' => 'alllowercaseletters', 'password_confirmation' => 'alllowercaseletters'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->postJson('/register', [...$base, 'terms' => true, 'email_saved_status_changes' => true])->assertCreated();

        $user = User::query()->where('email', 'new@example.org')->firstOrFail();
        $this->assertSame(Role::Donor, $user->role);
        $this->assertTrue($user->resolvedPreferences()['email_saved_status_changes']);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_register_does_not_reveal_existing_accounts(): void
    {
        User::factory()->create(['email' => 'taken@example.org']);

        $this->postJson('/register', [
            'name' => 'Someone', 'email' => 'taken@example.org', 'password' => 'Correct-horse-12',
            'password_confirmation' => 'Correct-horse-12', 'terms' => true,
        ])->assertCreated();
        $this->assertSame(1, User::query()->where('email', 'taken@example.org')->count());
    }

    public function test_password_recovery_flow(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'juan.demo@example.org']);

        $known = $this->postJson('/forgot-password', ['email' => 'juan.demo@example.org'])->assertOk();
        $unknown = $this->postJson('/forgot-password', ['email' => 'ghost@example.org'])->assertOk();
        $this->assertSame($known->json('message'), $unknown->json('message'));

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use ($user) {
            $this->assertStringStartsWith(config('app.frontend_url').'/reset-password?token=', $n->toMail($user)->actionUrl);

            return true;
        });

        $this->postJson('/reset-password', [
            'token' => 'bogus', 'email' => $user->email, 'password' => 'Brand-new-pass-1', 'password_confirmation' => 'Brand-new-pass-1',
        ])->assertUnprocessable()->assertJsonPath('code', 'invalid_token');

        $token = Password::createToken($user);
        $this->postJson('/reset-password', [
            'token' => $token, 'email' => $user->email, 'password' => 'Brand-new-pass-1', 'password_confirmation' => 'Brand-new-pass-1',
        ])->assertOk();
        $this->postJson('/login', ['email' => $user->email, 'password' => 'Brand-new-pass-1'])->assertOk();
    }

    public function test_reset_links_expire_after_30_minutes(): void
    {
        $user = User::factory()->create();
        $token = Password::createToken($user);

        $this->travel(31)->minutes();
        $this->postJson('/reset-password', [
            'token' => $token, 'email' => $user->email, 'password' => 'Brand-new-pass-1', 'password_confirmation' => 'Brand-new-pass-1',
        ])->assertUnprocessable()->assertJsonPath('code', 'invalid_token');
    }

    public function test_paused_requests_are_hidden_from_the_detail_url_too(): void
    {
        $paused = BloodRequest::factory()->by($this->submitter)->active()->create(['paused_at' => now()]);

        $this->getJson("/api/requests/{$paused->public_id}")->assertNotFound();
    }
}
