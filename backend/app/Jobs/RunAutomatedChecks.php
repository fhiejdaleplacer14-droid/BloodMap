<?php

namespace App\Jobs;

use App\Models\BloodRequest;
use App\Services\DescriptionScreener;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Runs on submit (51:523). Results are warnings for the coordinator
 * ("2 automated checks need a look", 44:1083) — they never block.
 */
class RunAutomatedChecks implements ShouldQueue
{
    use Queueable;

    public const DESK_HOURS_MISSING = 'desk_hours_missing';

    public function __construct(public BloodRequest $request) {}

    public function handle(DescriptionScreener $screener): void
    {
        $request = $this->request->fresh(['coordinationPoint']);
        if (! $request) {
            return;
        }

        // Both texts are shown publicly.
        $flags = $screener->screen($request->public_summary."\n".$request->response_instructions);
        if (blank($request->coordinationPoint?->hours)) {
            $flags[] = self::DESK_HOURS_MISSING;
        }

        $duplicate = $request->findPossibleDuplicate() !== null;

        $request->forceFill(['screening_flags' => $flags, 'possible_duplicate' => $duplicate])->saveQuietly();
    }
}
