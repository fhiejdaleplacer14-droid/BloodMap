<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Accounts are removed within 30 days of a deletion request (29:1428).
 * Saved requests and notifications go with the user; submitted requests stay
 * (submitter set to null) and the audit log keeps its plain references.
 */
class PurgeDeletedUsers extends Command
{
    protected $signature = 'users:purge-deleted';

    protected $description = 'Delete accounts whose deletion was requested 30 or more days ago';

    public function handle(): int
    {
        $count = 0;

        // Deletion requests after 30 days; deactivated accounts not restored within 90 days.
        User::query()
            ->where(fn ($q) => $q
                ->where('deletion_requested_at', '<=', now()->subDays(30))
                ->orWhere('deactivated_at', '<=', now()->subDays(90)))
            ->chunkById(100, function ($users) use (&$count) {
                foreach ($users as $user) {
                    $user->notifications()->delete();
                    $user->delete();
                    $count++;
                }
            });

        $this->info("Purged {$count} account(s).");

        return self::SUCCESS;
    }
}
