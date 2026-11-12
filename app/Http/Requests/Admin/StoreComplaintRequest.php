<?php
// app/Http/Requests/Admin/StoreComplaintRequest.php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreComplaintRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * Same rules as ajax/complaint_create.php.
     * Laravel trims text and converts empty strings to null before these run.
     */
    public function rules(): array
    {
        return [
            'title'       => ['required', 'string', 'max:200'],
            'description' => ['required', 'string', 'max:10000'],

            // Must exist AND be active, like "WHERE category_id = ? AND is_active = 1"
            'category_id' => ['nullable', 'integer', Rule::exists('complaint_categories', 'category_id')->where('is_active', 1)],
            'province_id' => ['nullable', 'integer', Rule::exists('provinces', 'province_id')->where('is_active', 1)],

            'priority'         => ['nullable', 'in:low,normal,high,urgent'],   // blank = normal
            'received_channel' => ['required', 'in:phone,email,letter,walk_in,referral,social_media,other'],

            // Not in the future (5 minutes of leeway, like your time() + 300)
            'received_at'       => ['required', 'date', 'before_or_equal:+5 minutes'],
            // Incident cannot be after the received date
            'incident_datetime' => ['nullable', 'date', 'before_or_equal:received_at'],
            // Target date cannot be before the received DATE (day only, so a custom rule)
            'target_date' => [
                'nullable',
                'date_format:Y-m-d',
                'after_or_equal:today',
                function ($attribute, $value, $fail) {
                    $received = strtotime((string) $this->input('received_at'));

                    if ($received !== false && $value < date('Y-m-d', $received)) {
                        $fail('The target date cannot be before the received date.');
                    }
                },
            ],

            'municipality'      => ['nullable', 'string', 'max:100'],
            'barangay'          => ['nullable', 'string', 'max:100'],
            'specific_location' => ['nullable', 'string', 'max:255'],

            'is_anonymous'        => ['boolean'],
            'complainant_name'    => ['nullable', 'string', 'max:150'],
            'complainant_contact' => [
                'nullable',
                'string',
                'regex:/^09[0-9]{9}$/',
            ],
            'complainant_email'   => ['nullable', 'email', 'max:150'],
        ];
    }

    /** Your original wording. */
    public function messages(): array
    {
        return [
            'title.required'          => 'Enter a title or subject.',
            'title.max'               => 'Keep the title within 200 characters.',
            'description.required'    => 'Enter a description of the complaint.',
            'description.max'         => 'The description is too long (10,000 characters maximum).',
            'received_channel.required' => 'Choose how the complaint was received.',
            'received_channel.in'     => 'Choose how the complaint was received.',
            'priority.in'             => 'Choose a valid priority.',
            'category_id.exists'      => 'Choose a valid category.',
            'province_id.exists'      => 'Choose a valid province.',
            'received_at.required'    => 'Enter the date and time the complaint was received.',
            'received_at.date'        => 'Enter the date and time the complaint was received.',
            'received_at.before_or_equal' => 'The received date cannot be in the future.',
            'incident_datetime.date'  => 'Enter a valid incident date and time, or leave it blank if unknown.',
            'incident_datetime.before_or_equal' => 'The incident cannot be after the received date.',
            'target_date.date_format' => 'Enter a valid target date.',
            'municipality.max'        => 'Maximum 100 characters.',
            'barangay.max'            => 'Maximum 100 characters.',
            'specific_location.max'   => 'Maximum 255 characters.',
            'complainant_name.max'    => 'Maximum 150 characters.',
            'complainant_contact.regex' => 'Contact number must start with 09 and contain exactly 11 digits (e.g., 09876543212).',
            'complainant_email.email' => 'Enter a valid email address.',
            'complainant_email.max'   => 'Enter a valid email address.',
        ];
    }
}