<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\Assistant\AssistantEngine;
use App\Services\Assistant\GeminiAssistant;
use App\Services\Assistant\HelpArticleAssistant;
use App\Services\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Editable System settings (41:2021, decision #93): stored, audited and used by the rules. */
class SystemSettingsTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
        $this->admin = User::factory()->admin()->create();
    }

    public function test_defaults_are_returned_until_changed(): void
    {
        $this->actingAs($this->admin)->getJson('/api/admin/settings')->assertOk()
            ->assertJsonPath('data.values', Settings::DEFAULTS)
            ->assertJsonPath('data.expiry.max_extension_hours', 72);
    }

    public function test_saving_changes_audits_each_changed_key(): void
    {
        $this->actingAs($this->admin)->patchJson('/api/admin/settings', ['values' => [
            'expiry.max_extension_hours' => 48,
            'expiry.reminder_hours' => 6, // unchanged
            'notifications.weekly_digest' => true,
        ]])->assertOk()->assertJsonPath('data.changed', ['expiry.max_extension_hours', 'notifications.weekly_digest']);

        $this->actingAs($this->admin)->getJson('/api/admin/settings')
            ->assertJsonPath('data.expiry.max_extension_hours', 48)
            ->assertJsonPath('data.notifications.weekly_digest', true);
        $log = AuditLog::query()->where('action', 'settings.updated')->where('meta->target_label', 'expiry.max_extension_hours')->firstOrFail();
        $this->assertSame(['72', '48'], [$log->from, $log->to]);
        $this->assertSame(2, AuditLog::query()->where('action', 'settings.updated')->count());
    }

    public function test_values_are_validated_and_retention_needs_a_reason(): void
    {
        $this->actingAs($this->admin)->patchJson('/api/admin/settings', ['values' => ['expiry.max_extension_hours' => 500]])
            ->assertUnprocessable();
        $this->actingAs($this->admin)->patchJson('/api/admin/settings', ['values' => ['general.assistant' => 'chaos']])
            ->assertUnprocessable();
        $this->actingAs($this->admin)->patchJson('/api/admin/settings', ['values' => ['retention.inactive_saved_days' => 60]])
            ->assertJsonValidationErrors('reason');
        $this->actingAs($this->admin)->patchJson('/api/admin/settings', ['values' => ['retention.inactive_saved_days' => 60], 'reason' => 'Donors asked for longer history.'])
            ->assertOk();
        $this->assertSame(60, Settings::int('retention.inactive_saved_days'));

        $this->actingAs($this->coordinator())->patchJson('/api/admin/settings', ['values' => ['expiry.reminder_hours' => 3]])->assertForbidden();
    }

    public function test_the_extension_limit_follows_the_setting(): void
    {
        Settings::update(['expiry.max_extension_hours' => 24], $this->admin, null);
        $request = $this->activeRequest(['expires_at' => now()->addHours(2)]);

        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/extend", ['hours' => 48])
            ->assertJsonValidationErrors('hours');
        $this->actingAs($this->submitter)->postJson("/api/requests/{$request->public_id}/extend")->assertOk();
        $this->assertEqualsWithDelta(now()->addHours(26)->timestamp, $request->refresh()->expires_at?->timestamp, 5);
    }

    public function test_the_assistant_setting_can_turn_the_ai_off(): void
    {
        config(['services.assistant.driver' => 'gemini', 'services.gemini.key' => 'test-key']);
        $this->assertInstanceOf(GeminiAssistant::class, app(AssistantEngine::class));

        Settings::update(['general.assistant' => 'articles'], $this->admin, null);
        $this->assertInstanceOf(HelpArticleAssistant::class, app(AssistantEngine::class));
    }
}
