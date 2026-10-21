<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\CoordinatorInvite;
use App\Models\User;
use App\Notifications\CoordinatorInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** "Invite coordinator" (41:1289, decision #95). */
class CoordinatorInviteTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    private User $admin;

    private ?string $token = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
        $this->admin = User::factory()->admin()->create();
        Notification::fake();
    }

    private function invite(string $email = 'new.coord@example.org'): int
    {
        $id = $this->actingAs($this->admin)->postJson('/api/admin/coordinator-invites', [
            'name' => 'Nina Coordinator', 'email' => $email, 'area_id' => $this->area->getKey(),
        ])->assertCreated()->json('data.id');

        Notification::assertSentTo(new AnonymousNotifiable, CoordinatorInvitation::class, function (CoordinatorInvitation $n, array $channels, AnonymousNotifiable $to) use ($email) {
            $this->token = basename($n->toMail($to)->actionUrl);

            return $to->routes['mail'] === $email;
        });

        return $id;
    }

    public function test_an_invitee_accepts_and_becomes_a_signed_in_coordinator(): void
    {
        $this->invite();
        $this->actingAs($this->admin)->getJson('/api/admin/coordinators')
            ->assertJsonPath('meta.invites.0.email', 'new.coord@example.org')
            ->assertJsonPath('meta.invites.0.expired', false);
        $this->assertNotSame($this->token, CoordinatorInvite::query()->value('token_hash'), 'only a hash is stored');

        auth()->forgetGuards();
        $this->app['auth']->guard('web')->logout();
        $this->getJson("/api/invites/{$this->token}")->assertOk()->assertJsonPath('data.area', $this->area->name);
        $this->postJson("/invites/{$this->token}/accept", [
            'name' => 'Nina Coordinator', 'password' => 'Long-enough-pass-2026!', 'password_confirmation' => 'Long-enough-pass-2026!',
        ])->assertCreated();

        $user = User::query()->where('email', 'new.coord@example.org')->firstOrFail();
        $this->assertSame(Role::Coordinator, $user->role);
        $this->assertSame($this->area->getKey(), $user->area_id);
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertAuthenticatedAs($user, 'web');

        // The link works once.
        $this->getJson("/api/invites/{$this->token}")->assertNotFound();
    }

    public function test_existing_accounts_and_duplicate_invites_are_refused(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/coordinator-invites', [
            'name' => 'Ana', 'email' => $this->submitter->email, 'area_id' => $this->area->getKey(),
        ])->assertJsonValidationErrors('email');

        $this->invite();
        $this->actingAs($this->admin)->postJson('/api/admin/coordinator-invites', [
            'name' => 'Nina', 'email' => 'NEW.coord@example.org', 'area_id' => $this->area->getKey(),
        ])->assertJsonValidationErrors('email');
    }

    public function test_resend_replaces_the_link_and_revoke_ends_it(): void
    {
        $id = $this->invite();
        $first = $this->token;

        $this->actingAs($this->admin)->postJson("/api/admin/coordinator-invites/{$id}/resend")->assertOk();
        $this->getJson("/api/invites/{$first}")->assertNotFound();

        $this->actingAs($this->admin)->deleteJson("/api/admin/coordinator-invites/{$id}")->assertNoContent();
        $this->actingAs($this->admin)->getJson('/api/admin/coordinators')->assertJsonCount(0, 'meta.invites');
        $this->actingAs($this->admin)->postJson("/api/admin/coordinator-invites/{$id}/resend")->assertConflict();
    }

    public function test_expired_links_do_not_work(): void
    {
        $this->invite();
        $this->travel(CoordinatorInvite::VALID_DAYS + 1)->days();

        $this->getJson("/api/invites/{$this->token}")->assertNotFound();
        $this->postJson("/invites/{$this->token}/accept", [
            'name' => 'Nina', 'password' => 'Long-enough-pass-2026!', 'password_confirmation' => 'Long-enough-pass-2026!',
        ])->assertNotFound();
    }
}
