<?php

namespace App\Enums;

/**
 * Request lifecycle (Figma 33:1787). One enum drives every badge, filter and
 * permission. Expired, Closed and Rejected never re-open.
 */
enum RequestStatus: string
{
    case Draft = 'draft';
    case PendingReview = 'pending_review';
    case NeedsCorrection = 'needs_correction';
    case Active = 'active';
    case Fulfilled = 'fulfilled';
    case Closed = 'closed';
    case Expired = 'expired';
    case Rejected = 'rejected';

    /** Visible to anyone at its detail URL (with a banner when not active). */
    public function isPubliclyVisible(): bool
    {
        return in_array($this, [self::Active, self::Fulfilled, self::Closed, self::Expired], true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Fulfilled, self::Closed, self::Expired, self::Rejected], true);
    }

    /** The submitter may edit the request's fields. */
    public function isEditableBySubmitter(): bool
    {
        return in_array($this, [self::Draft, self::NeedsCorrection, self::Active], true);
    }

    /** Allowed transitions; anything else is a 409. */
    public function canTransitionTo(self $to): bool
    {
        return in_array($to, match ($this) {
            self::Draft => [self::PendingReview],
            self::PendingReview => [self::Active, self::NeedsCorrection, self::Rejected],
            self::NeedsCorrection => [self::PendingReview],
            self::Active => [self::Fulfilled, self::Closed, self::Expired, self::PendingReview],
            default => [],
        }, true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
