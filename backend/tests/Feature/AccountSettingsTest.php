<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Profile & Privacy (29:890) and My Activity (29:625). */
class AccountSettingsTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
    }

    public function test_editing_the_email_requires_verifying_it_again(): void
    {
        Notification::fake();
        $donor = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($donor)->patchJson('/api/me', ['name' => 'Juan D.', 'email' => 'New@Example.org'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Juan D.')
            ->assertJsonPath('data.email', 'new@example.org')
            ->assertJsonPath('data.email_verified', false);
        Notification::assertSentTo($donor, VerifyEmail::class);

        $other = User::factory()->create();
        $this->actingAs($donor)->patchJson('/api/me', ['email' => $other->email])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_changing_the_password_needs_the_current_one(): void
    {
        $donor = User::factory()->create(['password' => 'Old-password-123']);

        $this->actingAs($donor)->putJson('/api/me/password', [
            'current_password' => 'wrong', 'password' => 'Brand-new-pass-9', 'password_confirmation' => 'Brand-new-pass-9',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->actingAs($donor)->putJson('/api/me/password', [
            'current_password' => 'Old-password-123', 'password' => 'Brand-new-pass-9', 'password_confirmation' => 'Brand-new-pass-9',
        ])->assertOk();

        $donor->refresh();
        $this->assertTrue(Hash::check('Brand-new-pass-9', $donor->password));
        $this->assertNotNull($donor->password_changed_at);
    }

    public function test_sessions_show_device_only_and_can_be_ended(): void
    {
        $donor = User::factory()->create();
        DB::table('sessions')->insert([
            'id' => 'other-session', 'user_id' => $donor->getKey(), 'ip_address' => '203.0.113.9',
            'user_agent' => 'Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile Safari/537.36',
            'payload' => '', 'last_activity' => now()->subDay()->getTimestamp(),
        ]);

        $sessions = $this->actingAs($donor)->getJson('/api/me/sessions')->assertOk();
        $sessions->assertJsonPath('data.0.device', 'Chrome · Android');
        $this->assertStringNotContainsString('203.0.113.9', $sessions->getContent());
        $this->assertStringNotContainsString('other-session', $sessions->getContent());

        $this->actingAs($donor)->deleteJson('/api/me/sessions/'.$sessions->json('data.0.id'))->assertOk();
        $this->assertDatabaseMissing('sessions', ['id' => 'other-session']);
        $this->actingAs($donor)->deleteJson('/api/me/sessions/not-a-session')->assertNotFound();
    }

    public function test_deactivation_is_undone_by_signing_in(): void
    {
        $donor = User::factory()->create(['password' => 'Correct-horse-9']);

        $this->actingAs($donor)->postJson('/api/me/deactivate')->assertOk();
        $this->assertNotNull($donor->refresh()->deactivated_at);

        $this->app['auth']->forgetGuards();
        $this->postJson('/login', ['email' => $donor->email, 'password' => 'Correct-horse-9'])->assertOk();
        $this->assertNull($donor->refresh()->deactivated_at);
    }

    public function test_activity_filters_and_export(): void
    {
        $donor = User::factory()->create();
        $request = $this->activeRequest();
        $this->actingAs($donor)->postJson("/api/me/saved-requests/{$request->public_id}")->assertNoContent();
        $this->actingAs($donor)->patchJson('/api/me/preferences', ['email_weekly_area_summary' => true])->assertOk();

        $this->actingAs($donor)->getJson('/api/me/activity?group=saved')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($donor)->getJson('/api/me/activity?group=preferences')->assertJsonCount(1, 'data');
        $this->actingAs($donor)->getJson('/api/me/activity?from=2020-01-01&to=2020-01-31')->assertJsonCount(0, 'data');
        $this->actingAs($donor)->getJson('/api/me/activity?group=nope')->assertUnprocessable();

        $export = $this->actingAs($donor)->get('/api/me/export')->assertOk();
        $data = json_decode($export->streamedContent(), true);
        $this->assertSame($donor->email, $data['account']['email']);
        $this->assertSame([$request->public_id], $data['saved_requests']);
    }
}
