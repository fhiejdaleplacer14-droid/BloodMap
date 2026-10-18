<?php

namespace App\Enums;

/** Requester-stated time window — never a triage level (Figma 5:222). */
enum Urgency: string
{
    case Within24h = 'within_24h';
    case Within72h = 'within_72h';
    case Scheduled = 'scheduled';

    /** Sort weight: most time-sensitive first. */
    public function rank(): int
    {
        return match ($this) {
            self::Within24h => 0,
            self::Within72h => 1,
            self::Scheduled => 2,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
