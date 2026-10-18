<?php

namespace App\Http\Requests;

use App\Enums\BloodType;
use App\Enums\ContactMethod;
use App\Enums\ContactVisibility;
use App\Enums\RequestCategory;
use App\Models\BloodRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create wizard fields (07 · Create steps 1–2). Drafts may be incomplete;
 * completeness is checked on submit. No patient fields exist (51:583).
 */
class UpsertBloodRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $today = now(BloodRequest::LOCAL_TIME_ZONE)->toDateString();

        return [
            'blood_type' => [$creating ? 'required' : 'sometimes', Rule::enum(BloodType::class)],
            'units_requested' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:50'],
            'needed_by' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:'.$today],
            'desk_window_start' => ['sometimes', 'nullable', 'date_format:H:i', 'required_with:desk_window_end'],
            'desk_window_end' => ['sometimes', 'nullable', 'date_format:H:i', 'required_with:desk_window_start', 'after:desk_window_start'],
            'municipality_id' => [$creating ? 'required' : 'sometimes', 'integer', 'exists:municipalities,id'],
            'category' => ['sometimes', 'nullable', Rule::enum(RequestCategory::class)],
            'public_summary' => ['sometimes', 'nullable', 'string', 'max:280'],
            'coordination_point_id' => ['sometimes', 'integer', Rule::in([$this->user()->coordination_point_id])],
            'contact_method' => ['sometimes', Rule::enum(ContactMethod::class)],
            'contact_visible_to' => ['sometimes', Rule::enum(ContactVisibility::class)],
            'response_instructions' => ['sometimes', 'nullable', 'string', 'max:400'],
        ];
    }

    public function messages(): array
    {
        return [
            'coordination_point_id.in' => 'You can only submit for your authorized coordination point.',
            'needed_by.after_or_equal' => 'Date can’t be in the past.',
        ];
    }

    /** @return array<string, mixed> Validated input with nulls normalised for text columns. */
    public function fields(): array
    {
        $data = $this->validated();
        foreach (['public_summary', 'response_instructions'] as $text) {
            if (array_key_exists($text, $data)) {
                $data[$text] = trim((string) $data[$text]);
            }
        }

        return $data;
    }
}
