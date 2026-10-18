<?php

use Illuminate\Support\Facades\Schedule;

// Expiry is automatic (51:593).
Schedule::command('requests:expire')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('requests:remind-expiring')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('users:purge-deleted')->daily()->withoutOverlapping();
