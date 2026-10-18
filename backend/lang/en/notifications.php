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
            'subject' => ':id expires in about 6 hours',
            'line' => 'A request you saved, :id, expires in about 6 hours.',
        ],
    ],
];
