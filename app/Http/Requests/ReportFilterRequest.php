<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class ReportFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q'           => ['nullable', 'string', 'max:100'],
            'from'        => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'to'          => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:from'],
            'status_id'   => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'province_id' => ['nullable', 'integer'],
            'office_id'   => ['nullable', 'regex:/^(none|\d+)$/'],
            'priority'    => ['nullable', 'in:urgent,high,normal,low'],
            'overdue'     => ['nullable', 'in:1'],
            'page'        => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        $dates = 'Dates must be valid and cannot be in the future.';

        return [
            'from.date_format'     => $dates,
            'from.before_or_equal' => $dates,
            'to.date_format'       => $dates,
            'to.before_or_equal'   => $dates,
            'to.after_or_equal'    => 'The start date must be on or before the end date.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        $msg = $validator->errors()->first();

        throw new HttpResponseException(
            $this->expectsJson()
                ? response()->json(['ok' => false, 'error' => $msg], 422)
                : response($msg, 422)
        );
    }
}