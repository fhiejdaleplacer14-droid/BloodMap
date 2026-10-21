<?php

namespace App\Console\Commands;

use App\Models\BloodRequest;
use App\Models\User;
use App\Notifications\WeeklySummary;
use App\Services\Settings;
use Illuminate\Console\Command;

/**
 * Mondays 08:00 Manila (decision #96). Sent only when System settings turns
 * the digest on, and only to verified, active accounts that opted in.
 */
class SendWeeklySummary extends Command
{
    protected $signature = 'digest:weekly';

    protected $description = 'Email the weekly summary of public requests to people who opted in';

    public function handle(): int
    {
        if (! Settings::bool('notifications.weekly_digest')) {
            $this->info('Weekly digest is switched off in System settings.');

            return self::SUCCESS;
        }

        $summary = $this->summary();
        $count = 0;
        User::query()
            ->whereNotNull('email_verified_at')
            ->whereNull('deletion_requested_at')
            ->whereNull('deactivated_at')
            ->whereNull('restricted_at')
            ->where('preferences->email_weekly_area_summary', true)
            ->chunkById(200, function ($users) use ($summary, &$count) {
                foreach ($users as $user) {
                    $user->notify(new WeeklySummary($summary));
                    $count++;
                }
            });

        $this->info("Sent the weekly summary to {$count} people.");

        return self::SUCCESS;
    }

    /** @return array{active: int, new: int, types: array<string, int>, expiring: list<array{id: string, type: string, place: string, when: string}>} */
    public function summary(): array
    {
        $listed = fn () => BloodRequest::query()->publiclyListed();
        $tz = BloodRequest::LOCAL_TIME_ZONE;

        return [
            'active' => $listed()->count(),
            'new' => $listed()->where('published_at', '>=', now()->subDays(7))->count(),
            'types' => $listed()->toBase()->selectRaw('blood_type, count(*) as total')->groupBy('blood_type')->orderByDesc('total')
                ->pluck('total', 'blood_type')->map(fn ($n) => (int) $n)->all(),
            'expiring' => $listed()->with('municipality')->orderBy('expires_at')->limit(5)->get()
                ->map(fn (BloodRequest $r) => [
                    'id' => $r->public_id,
                    'type' => $r->blood_type->value,
                    'place' => (string) $r->municipality?->name,
                    'when' => (string) $r->expires_at?->setTimezone($tz)->format('M j, H:i'),
                ])->values()->all(),
        ];
    }
}
