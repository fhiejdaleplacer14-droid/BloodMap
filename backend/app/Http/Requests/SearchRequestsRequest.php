<?php

namespace App\Http\Requests;

use App\Enums\BloodType;
use App\Enums\Urgency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * GET /api/requests filters (decision #8). Invalid values are a 422 so the
 * Explorer can show its "Invalid filter" state.
 */
class SearchRequestsRequest extends FormRequest
{
    public const SORTS = ['-updated_at', 'urgency', 'expires_at', '-published_at'];

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'bbox' => ['sometimes', 'string', 'regex:/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/'],
            'blood_type' => ['sometimes', 'array', 'max:8'],
            'blood_type.*' => [Rule::enum(BloodType::class)],
            'urgency' => ['sometimes', 'array', 'max:3'],
            'urgency.*' => [Rule::enum(Urgency::class)],
            // Public search lists live requests only (51:502).
            'status' => ['sometimes', Rule::in(['active'])],
            'posted_after' => ['sometimes', 'date_format:Y-m-d', 'before_or_equal:today'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'sort' => ['sometimes', Rule::in(self::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $bbox = $this->bbox();
                if ($bbox === null) {
                    return;
                }
                [$minLng, $minLat, $maxLng, $maxLat] = $bbox;
                if ($minLng > $maxLng || $minLat > $maxLat || abs($minLat) > 90 || abs($maxLat) > 90 || abs($minLng) > 180 || abs($maxLng) > 180) {
                    $validator->errors()->add('bbox', 'The bounding box must be minLng,minLat,maxLng,maxLat.');
                }
            },
        ];
    }

    /** @return array{0: float, 1: float, 2: float, 3: float}|null */
    public function bbox(): ?array
    {
        $raw = $this->input('bbox');
        if (! is_string($raw) || ! preg_match('/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/', $raw)) {
            return null;
        }
        /** @var array{0: float, 1: float, 2: float, 3: float} */
        return array_map('floatval', explode(',', $raw));
    }
}
