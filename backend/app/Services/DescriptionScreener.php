<?php

namespace App\Services;

/**
 * Server-side screening of the public summary (51:583). Produces warnings for
 * coordinators — never blocks, never stores structured patient fields.
 */
class DescriptionScreener
{
    public const POSSIBLE_PHONE = 'possible_phone_number';

    public const POSSIBLE_NAME = 'possible_personal_name';

    /** @return list<string> */
    public function screen(string $text): array
    {
        $flags = [];

        // PH mobile/landline shapes: 09xx…, +639xx…, (034) 4xx-xxxx, 7+ digit runs.
        $digits = '/(\+?63[\s-]?9\d{2}|\b09\d{2})[\s-]?\d{3}[\s-]?\d{4}\b|\(?0\d{2,3}\)?[\s-]?\d{3}[\s-]?\d{4}\b|\b\d{7,}\b/';
        if (preg_match($digits, $text)) {
            $flags[] = self::POSSIBLE_PHONE;
        }

        // Honorifics or "patient/name" followed by a capitalised word.
        $name = '/\b(Mr|Mrs|Ms|Miss|Dr|Sr|Jr|Gng|Ginang|G)\.?\s+[A-Z][a-z]+|\b(?i:patient|pasyente|name|ngalan)\s*[:\-]?\s+[A-Z][a-z]+/u';
        if (preg_match($name, $text)) {
            $flags[] = self::POSSIBLE_NAME;
        }

        return $flags;
    }
}
