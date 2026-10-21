<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(GeographySeeder::class);

        // Fictional, is_demo-flagged records. Never seeded in production unless SEED_DEMO_DATA=true.
        if (! app()->isProduction() || config('app.seed_demo')) {
            $this->call(DemoSeeder::class);
        }
    }
}
