<?php

namespace Tests\Unit;

use App\Enums\RequestStatus;
use App\Enums\Urgency;
use App\Models\BloodRequest;
use App\Services\DescriptionScreener;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Pure rules: lifecycle transitions, urgency/expiry maths, description screening. */
class RequestRulesTest extends TestCase
{
    public function test_terminal_statuses_never_reopen(): void
    {
        foreach ([RequestStatus::Fulfilled, RequestStatus::Closed, RequestStatus::Expired, RequestStatus::Rejected] as $terminal) {
            foreach (RequestStatus::cases() as $to) {
                $this->assertFalse($terminal->canTransitionTo($to), "{$terminal->value} → {$to->value}");
            }
        }
    }

    public function test_lifecycle_edges_match_the_diagram(): void
    {
        $this->assertTrue(RequestStatus::Draft->canTransitionTo(RequestStatus::PendingReview));
        $this->assertTrue(RequestStatus::PendingReview->canTransitionTo(RequestStatus::Active));
        $this->assertTrue(RequestStatus::PendingReview->canTransitionTo(RequestStatus::NeedsCorrection));
        $this->assertTrue(RequestStatus::NeedsCorrection->canTransitionTo(RequestStatus::PendingReview));
        $this->assertTrue(RequestStatus::Active->canTransitionTo(RequestStatus::Expired));
        $this->assertFalse(RequestStatus::Draft->canTransitionTo(RequestStatus::Active), 'publishing skips review');
        $this->assertFalse(RequestStatus::NeedsCorrection->canTransitionTo(RequestStatus::Active));
    }

    public function test_expiry_is_the_desk_window_end_in_manila_time(): void
    {
        $request = new BloodRequest(['needed_by' => '2026-10-18', 'desk_window_end' => '17:00']);

        $this->assertSame('2026-10-18T09:00:00+00:00', $request->windowClosesAt()?->toIso8601String());
    }

    public function test_expiry_defaults_to_17_00_without_a_window(): void
    {
        $request = new BloodRequest(['needed_by' => '2026-10-18']);

        $this->assertSame('2026-10-18T09:00:00+00:00', $request->windowClosesAt()?->toIso8601String());
    }

    /** @return array<string, array{string, Urgency}> */
    public static function urgencyCases(): array
    {
        // Window closes 2026-10-18 09:00 UTC.
        return [
            'same day' => ['2026-10-18T01:00:00Z', Urgency::Within24h],
            'exactly 24 h' => ['2026-10-17T09:00:00Z', Urgency::Within24h],
            'two days' => ['2026-10-16T12:00:00Z', Urgency::Within72h],
            'a week' => ['2026-10-11T09:00:00Z', Urgency::Scheduled],
        ];
    }

    #[DataProvider('urgencyCases')]
    public function test_urgency_is_derived_from_the_needed_by_time(string $now, Urgency $expected): void
    {
        $request = new BloodRequest(['needed_by' => '2026-10-18', 'desk_window_end' => '17:00']);

        $this->assertSame($expected, $request->deriveUrgency(Carbon::parse($now)));
    }

    /** @return array<string, array{string, list<string>}> */
    public static function screeningCases(): array
    {
        return [
            'clean' => ['2 units requested for a scheduled procedure.', []],
            'mobile' => ['Call 0917 123 4567 for details.', [DescriptionScreener::POSSIBLE_PHONE]],
            'intl mobile' => ['Text +63 917 123 4567.', [DescriptionScreener::POSSIBLE_PHONE]],
            'landline' => ['Desk (034) 432-1234.', [DescriptionScreener::POSSIBLE_PHONE]],
            'honorific' => ['For Mrs. Reyes in ward 3.', [DescriptionScreener::POSSIBLE_NAME]],
            'patient label' => ['Patient: Maria Santos', [DescriptionScreener::POSSIBLE_NAME]],
            'request id is fine' => ['Mention request BM-2026-0012 at the desk.', []],
        ];
    }

    /** @param  list<string>  $expected */
    #[DataProvider('screeningCases')]
    public function test_description_screening(string $text, array $expected): void
    {
        $this->assertSame($expected, (new DescriptionScreener)->screen($text));
    }
}
