<?php

// Email copy for request notifications. Keep it factual: BloodMap never
// promises availability, eligibility or fulfilment.
return [
    'request' => [
        'action' => 'View request',
        'approved' => [
            'subject' => ':id is now public',
            'line' => 'A coordinator approved :id. It is now listed on the public map until it expires.',
        ],
        'needs_correction' => [
            'subject' => ':id needs a correction',
            'line' => 'A coordinator sent :id back with a note. Edit and resubmit it to continue.',
        ],
        'rejected' => [
            'subject' => ':id was not published',
            'line' => 'A coordinator reviewed :id and did not publish it.',
        ],
        'status_changed' => [
            'subject' => ':id was updated',
            'line' => 'A request you saved, :id, changed status.',
        ],
        'expired' => [
            'subject' => ':id has expired',
            'line' => ':id reached its expiry time and is no longer listed.',
        ],
        'expiring_soon' => [
            'subject' => ':id expires in about :hours hours',
            'line' => 'A request you saved, :id, expires in about :hours hours.',
        ],
    ],
    'invite' => [
        'subject' => 'You are invited to coordinate on :app',
        'greeting' => 'Hello :name,',
        'line' => 'An administrator invited you to review blood requests for :area. Accept the invite to set your password and open your review queue.',
        'action' => 'Accept invite',
        'expiry' => 'This link works once and expires in :days days. If you weren’t expecting it, you can ignore this email.',
    ],
    'digest' => [
        'subject' => 'This week on BloodMap NIR',
        'intro' => 'Here is a summary of public blood requests across Negros Island Region this week.',
        'active' => ':count active request(s) right now; :new posted in the last 7 days.',
        'types' => 'Blood types requested: :types.',
        'none' => 'There are no active requests right now.',
        'expiring' => 'Expiring soonest:',
        'item' => ':id · :type · :place · expires :when',
        'action' => 'Explore requests',
        'footer' => 'BloodMap shares coordination details only. Facility staff decide who can donate. Turn this email off in Profile and Preferences.',
    ],
];
