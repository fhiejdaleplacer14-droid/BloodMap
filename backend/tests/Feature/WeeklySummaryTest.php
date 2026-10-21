<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\WeeklySummary;
use App\Services\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\BuildsWorld;
use Tests\TestCase;

/** Weekly area summary (29:1149, decision #96). */
class WeeklySummaryTest extends TestCase
{
    use BuildsWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildWorld();
        Notification::fake();
    }

    public function test_nothing_is_sent_while_the_digest_is_switched_off(): void
    {
        User::factory()->create(['preferences' => ['email_weekly_area_summary' => true]]);

        $this->artisan('digest:weekly')->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_only_opted_in_active_accounts_get_it(): void
    {
        Settings::update(['notifications.weekly_digest' => true], User::factory()->admin()->create(), null);
        $this->activeRequest(['blood_type' => 'O+']);
        $this->activeRequest(['blood_type' => 'O+']);
        $this->activeRequest(['blood_type' => 'B-']);

        $optedIn = User::factory()->create(['preferences' => ['email_weekly_area_summary' => true]]);
        $optedOut = User::factory()->create();
        $deactivated = User::factory()->create(['preferences' => ['email_weekly_area_summary' => true]]);
        $deactivated->forceFill(['deactivated_at' => now()])->save();

        $this->artisan('digest:weekly')->assertSuccessful();

        Notification::assertSentTo($optedIn, WeeklySummary::class, fn (WeeklySummary $n) => $n->summary['active'] === 3
            && $n->summary['types'] === ['O+' => 2, 'B-' => 1]
            && count($n->summary['expiring']) === 3);
        Notification::assertNotSentTo([$optedOut, $deactivated], WeeklySummary::class);
    }
}
