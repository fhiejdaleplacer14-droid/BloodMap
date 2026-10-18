<?php

namespace App\Enums;

/** Roles (docs/decisions.md #11, Figma 30:682 · 39:1074). */
enum Role: string
{
    case Donor = 'donor';
    /** Bound to one coordination point; creates requests, cannot publish. */
    case FacilitySubmitter = 'facility_submitter';
    /** Bound to an area; reviews and publishes requests there. */
    case Coordinator = 'coordinator';
    case Admin = 'admin';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
