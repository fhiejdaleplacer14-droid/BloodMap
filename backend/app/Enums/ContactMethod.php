<?php

namespace App\Enums;

/** Contact method (31:588). Values always come from the approved coordination point. */
enum ContactMethod: string
{
    case DeskPhone = 'desk_phone';
    case DeskEmail = 'desk_email';
    /** "No direct contact — responders visit during desk hours". */
    case None = 'none';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
