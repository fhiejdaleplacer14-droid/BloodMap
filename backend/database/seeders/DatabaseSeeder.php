<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(GeographySeeder::class);

        // Fictional, is_demo-flagged records. Never seeded in production.
        if (! app()->isProduction()) {
            $this->call(DemoSeeder::class);
        }
    }
}
