<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\DemoSeeder;
use Database\Seeders\GeographySeeder;
use Illuminate\Console\Command;

/**
 * Run on every container start, after migrations (docs/deployment.md). Safe to
 * repeat: the region's geography is upserted, and fictional demo data is
 * added once, on an empty database, and only when SEED_DEMO_DATA=true.
 */
class FirstRun extends Command
{
    protected $signature = 'app:first-run';

    protected $description = 'Seed NIR geography, and the demo data once if SEED_DEMO_DATA=true';

    public function handle(): int
    {
        $this->callSilently('db:seed', ['--class' => GeographySeeder::class, '--force' => true]);
        $this->info('Geography is up to date.');

        if (! config('app.seed_demo')) {
            return self::SUCCESS;
        }
        if (User::query()->exists()) {
            $this->info('Demo data skipped: the database already has accounts.');

            return self::SUCCESS;
        }

        $this->callSilently('db:seed', ['--class' => DemoSeeder::class, '--force' => true]);
        $this->info('Seeded fictional demo data.');

        return self::SUCCESS;
    }
}
