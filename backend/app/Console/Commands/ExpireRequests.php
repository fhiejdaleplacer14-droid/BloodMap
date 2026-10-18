<?php

namespace App\Console\Commands;

use App\Enums\RequestStatus;
use App\Models\BloodRequest;
use App\Models\User;
use App\Notifications\RequestUpdate;
use Illuminate\Console\Command;

/**
 * Every 5 minutes (51:593): active & expires_at < now → expired; notify the
 * owner and savers; audit row. The detail URL stays resolvable with an
 * Expired banner.
 */
class ExpireRequests extends Command
{
    protected $signature = 'requests:expire';

    protected $description = 'Expire active requests whose expires_at has passed';

    public function handle(): int
    {
        $count = 0;

        BloodRequest::query()
            ->where('status', RequestStatus::Active)
            ->where('expires_at', '<', now())
            ->with(['submitter', 'savers', 'municipality'])
            ->chunkById(100, function ($requests) use (&$count) {
                foreach ($requests as $request) {
                    $request->transitionTo(RequestStatus::Expired, null, 'request.expired');
                    $recipients = $request->savers->push($request->submitter)->filter()->unique('id');
                    $recipients->each(fn (User $user) => $user->notify(new RequestUpdate($request, 'expired')));
                    $count++;
                }
            });

        $this->info("Expired {$count} request(s).");

        return self::SUCCESS;
    }
}
