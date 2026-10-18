<?php

namespace App\Enums;

/**
 * Request category (31:270). Only "Scheduled procedure" appears in the
 * Figma file; the full list is an open question (docs/decisions.md #17).
 */
enum RequestCategory: string
{
    case ScheduledProcedure = 'scheduled_procedure';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
