<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AuditListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // admin access is enforced by route middleware
    }

    public function rules(): array
    {
        $today = now('Asia/Manila')->toDateString();

        return [
            'q'           => ['nullable', 'string', 'max:100'],
            'from'        => ['nullable', 'date_format:Y-m-d', 'before_or_equal:' . $today],
            'to'          => array_filter([
                'nullable',
                'date_format:Y-m-d',
                'before_or_equal:' . $today,
                $this->filled('from') ? 'after_or_equal:from' : null,
            ]),
            'action'      => ['nullable', 'string', 'max:80'],
            'entity_type' => ['nullable', 'string', 'max:60'],
            'user_id'     => ['nullable', 'integer', 'min:1'],
            'page'        => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'from.before_or_equal' => 'Dates cannot be in the future.',
            'to.before_or_equal'   => 'Dates cannot be in the future.',
            'to.after_or_equal'    => 'The start date must be on or before the end date.',
            '*.date_format'        => 'Dates must be valid (YYYY-MM-DD).',
        ];
    }
}