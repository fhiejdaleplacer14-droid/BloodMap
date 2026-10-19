<?php

namespace App\Http\Requests;

use App\Enums\BloodType;
use App\Enums\Urgency;
use App\Models\BloodRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * GET /api/requests filters (decisions #8, #24). Invalid values are a 422 so
 * the Explorer can show its "Invalid filter" state.
 */
class SearchRequestsRequest extends FormRequest
{
    public const SORTS = ['-updated_at', 'urgency', 'expires_at', '-published_at'];

    /** Area filter (25:625). */
    public const PROVINCES = ['Negros Occidental', 'Negros Oriental', 'Siquijor'];

    /** "Recently fulfilled" (25:599) = fulfilled within this many days. */
    public const RECENTLY_FULFILLED_DAYS = 7;

    protected function prepareForValidation(): void
    {
        // Accept ?status=active as well as ?status[]=active.
        if (is_string($this->input('status'))) {
            $this->merge(['status' => [$this->input('status')]]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $today = now(BloodRequest::LOCAL_TIME_ZONE)->toDateString();

        return [
            'bbox' => ['sometimes', 'string', 'regex:/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/'],
            'blood_type' => ['sometimes', 'array', 'max:8'],
            'blood_type.*' => [Rule::enum(BloodType::class)],
            'urgency' => ['sometimes', 'array', 'max:3'],
            'urgency.*' => [Rule::enum(Urgency::class)],
            // Public search: live requests, optionally recently fulfilled ones.
            'status' => ['sometimes', 'array', 'max:2'],
            'status.*' => [Rule::in(['active', 'fulfilled'])],
            'posted_after' => ['sometimes', 'date_format:Y-m-d', 'before_or_equal:'.$today],
            // "To must be on or after From. Requests can't be posted in the future." (19:3185)
            'posted_before' => ['sometimes', 'date_format:Y-m-d', 'before_or_equal:'.$today, 'after_or_equal:posted_after'],
            'province' => ['sometimes', Rule::in(self::PROVINCES)],
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

    /** @return list<string> */
    public function statuses(): array
    {
        /** @var list<string> $statuses */
        $statuses = $this->input('status', ['active']);

        return $statuses;
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
