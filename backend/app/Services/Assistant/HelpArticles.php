<?php

namespace App\Services\Assistant;

/**
 * The approved help articles the guide may answer from (51:565 — "RAG over
 * approved help articles only"). Each article is a short, fixed answer plus
 * the words people use to ask about it. Copy must be reviewed by
 * blood-service staff before launch (56:258); see docs/decisions.md.
 *
 * `path` is where the full article lives in the app today.
 */
final class HelpArticles
{
    /** @var array<string, array{title: string, path: string, answer: string, keywords: list<string>}> */
    public const ALL = [
        'finding-requests' => [
            'title' => 'Finding a request',
            'path' => '/#how-it-works',
            'answer' => "Open Find Blood Requests and search a city or municipality. Filter by blood type, status or date posted, and switch between the list and the map.\n\nEach card shows the blood type, the city, how urgent the requester says it is and when it was last updated. Open a request to see its coordination steps.",
            'keywords' => ['find', 'search', 'look', 'browse', 'filter', 'map', 'list', 'near', 'city', 'explore', 'where'],
        ],
        'submitting-requests' => [
            'title' => 'Submitting a request',
            'path' => '/#how-it-works',
            'answer' => "Requests are submitted by authorized facility desks, not by individuals. A facility submitter fills in the request, the coordination point and a privacy check, then sends it for review.\n\nA coordinator checks the listing before anything becomes public. If you need blood for a patient, ask the hospital's blood services desk — they can submit through BloodMap.",
            'keywords' => ['submit', 'create', 'post', 'add', 'make', 'new request', 'publish', 'facility', 'hospital', 'need blood'],
        ],
        'request-statuses' => [
            'title' => 'Request statuses',
            'path' => '/#safety',
            'answer' => "Statuses describe where a request is in review — not whether blood is available.\n\n• Pending review: waiting for a coordinator.\n• Active: approved and visible; follow its coordination steps.\n• Fulfilled, Closed or Expired: no longer accepting responses.",
            'keywords' => ['status', 'statuses', 'pending', 'active', 'fulfilled', 'closed', 'expired', 'mean', 'meaning', 'review', 'badge'],
        ],
        'privacy-and-contact' => [
            'title' => 'Privacy and contact',
            'path' => '/#safety',
            'answer' => "Submitter and patient details are never shown publicly. Each request lists an authorized coordination point instead — contact them using the steps on the request page.\n\nLocations are generalized to the city or municipality, never a home or street address. Desk contact details are shown only to the people the facility allows, usually signed-in users.",
            'keywords' => ['privacy', 'private', 'personal', 'information', 'data', 'protect', 'who submitted', 'submitter', 'contact', 'phone', 'number', 'address', 'location', 'name', 'see who'],
        ],
        'safety-and-guidelines' => [
            'title' => 'Safety and guidelines',
            'path' => '/#safety',
            'answer' => 'You can still contact a request’s coordination point — staff there will screen you and explain what applies to you. Our donation guidelines page lists general questions to ask them.',
            'keywords' => ['safe', 'safety', 'guideline', 'guidelines', 'rules', 'screen', 'screening'],
        ],
        'coordination-desk' => [
            'title' => 'At the coordination desk',
            'path' => '/#how-it-works',
            'answer' => "Go to the coordination point listed on the request during its desk hours and mention the request ID. Facility staff check who can donate and handle everything from there.\n\nBloodMap doesn’t book appointments or confirm whether blood is still needed — the desk does.",
            'keywords' => ['desk', 'coordination', 'coordination point', 'happens', 'visit', 'go', 'arrive', 'hours', 'appointment', 'respond', 'help', 'volunteer'],
        ],
        'saving-and-updates' => [
            'title' => 'Saving requests and updates',
            'path' => '/app/saved',
            'answer' => "Sign in and choose Save on a request to follow it. You’ll see updates on your overview and, if you turn them on in Profile, by email — for example when a request you saved is updated, fulfilled or about to expire.\n\nSaving a request doesn’t notify anyone or commit you to anything.",
            'keywords' => ['save', 'saved', 'follow', 'bookmark', 'notify', 'notification', 'notifications', 'email', 'update', 'updates', 'remind', 'reminder'],
        ],
        'account' => [
            'title' => 'Your account',
            'path' => '/app/profile',
            'answer' => "You can browse requests without an account. An account lets you save requests and see desk contact details where the facility allows it.\n\nIn Profile you can change your name, email and password, see where you’re signed in, download your data, or deactivate or delete your account.",
            'keywords' => ['account', 'register', 'sign up', 'signup', 'log in', 'login', 'sign in', 'password', 'delete', 'deactivate', 'profile', 'download'],
        ],
    ];

    /** Fixed, non-generated note for eligibility or medical questions (12:960 Safety note, 55:371). */
    public const SAFETY_NOTE = 'I can’t assess whether you can donate. Eligibility is decided by qualified staff at the blood service facility.';

    /** Words that make a question about eligibility or health, not about using BloodMap. */
    public const MEDICAL = [
        'can i donate', 'can i still donate', 'am i eligible', 'eligible', 'eligibility', 'allowed to donate', 'qualify',
        'tattoo', 'piercing', 'pregnant', 'pregnancy', 'breastfeeding', 'medication', 'medicine', 'antibiotic', 'vaccine',
        'sick', 'fever', 'flu', 'covid', 'hepatitis', 'hiv', 'malaria', 'diabetes', 'blood pressure', 'hypertension', 'anemia',
        'surgery', 'weight', 'too young', 'too old', 'age limit', 'period', 'menstruation', 'alcohol', 'drink', 'smoke',
        'side effect', 'safe to donate', 'how often can i', 'symptom', 'diagnos', 'transfusion', 'compatible', 'which blood type can',
    ];

    /** Questions about one request's live state — never paraphrased (12:960). */
    public const LIVE = ['still needed', 'still need', 'is blood available', 'available now', 'how many units left', 'is it urgent', 'has it been fulfilled'];
}
