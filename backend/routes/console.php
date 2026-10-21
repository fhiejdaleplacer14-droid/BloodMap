<?php

use Illuminate\Support\Facades\Schedule;

// Expiry is automatic (51:593).
Schedule::command('requests:expire')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('requests:remind-expiring')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('users:purge-deleted')->daily()->withoutOverlapping();
// Weekly summary (decision #96); the command itself checks System settings.
Schedule::command('digest:weekly')->weeklyOn(1, '08:00')->timezone('Asia/Manila')->withoutOverlapping();
