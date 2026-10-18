<?php

namespace App\Enums;

/** Who may see a request's desk contact — enforced in the API resource (51:588). */
enum ContactVisibility: string
{
    case Public = 'public';
    case SignedIn = 'signed_in';
    case Coordinators = 'coordinators';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
