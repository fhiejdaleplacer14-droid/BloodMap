<?php

namespace App\Console\Commands;

use App\Enums\RequestStatus;
use App\Models\BloodRequest;
use App\Models\User;
use App\Notifications\RequestUpdate;
use Illuminate\Console\Command;

/** "Remind me 6 hours before a saved request expires" (29:1145) — once per expiry. */
class RemindExpiringRequests extends Command
{
    protected $signature = 'requests:remind-expiring';

    protected $description = 'Notify savers about requests that expire within 6 hours';

    public function handle(): int
    {
        $count = 0;

        BloodRequest::query()
            ->where('status', RequestStatus::Active)
            ->whereNull('paused_at')
            ->whereNull('expiry_reminder_sent_at')
            ->whereBetween('expires_at', [now(), now()->addHours(6)])
            ->with(['savers', 'municipality'])
            ->chunkById(100, function ($requests) use (&$count) {
                foreach ($requests as $request) {
                    $request->savers->each(fn (User $saver) => $saver->notify(new RequestUpdate($request, 'expiring_soon')));
                    $request->forceFill(['expiry_reminder_sent_at' => now()])->saveQuietly();
                    $count++;
                }
            });

        $this->info("Sent reminders for {$count} request(s).");

        return self::SUCCESS;
    }
}
