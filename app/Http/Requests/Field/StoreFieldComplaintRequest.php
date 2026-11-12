<?php

namespace App\Http\Requests\Field;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFieldComplaintRequest extends FormRequest
{
    private const TZ = 'Asia/Manila';
    private const DT = 'Y-m-d\TH:i';

    public function authorize(): bool
    {
        return true; // Your EnsureFieldOffice middleware already checked the role and office.
        // Validation errors use Laravel's normal 422 shape ({errors: {field: [msg]}}),
        // the same shape ComplaintWorkflow::fail() produces.
    }

    protected function prepareForValidation(): void
    {
        // Trim strings and turn empty strings into null (like the old $in() helper).
        $clean = [];
        foreach ($this->all() as $k => $v) {
            if (is_string($v)) {
                $v = trim($v);
                $v = $v === '' ? null : $v;
            }
            $clean[$k] = $v;
        }
        $this->replace($clean);
    }

    public function rules(): array
    {
        return [
            'title'              => ['required', 'string', 'max:200'],
            'description'        => ['required', 'string', 'max:10000'],
            'category_id'        => ['nullable', 'integer', Rule::exists('complaint_categories', 'category_id')->where('is_active', 1)],
            'priority'           => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'received_channel'   => ['required', Rule::in(['phone', 'email', 'letter', 'walk_in', 'referral', 'social_media', 'other'])],
            'received_at'        => ['required', 'date_format:' . self::DT],
            'incident_datetime'  => ['nullable', 'date_format:' . self::DT],
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
            // Optional: an unknown location is allowed, same as the admin form and the old PHP endpoint.
            'province_id'        => ['nullable', 'integer', Rule::exists('provinces', 'province_id')->where('is_active', 1)],
            'municipality'       => ['nullable', 'string', 'max:100'],
            'barangay'           => ['nullable', 'string', 'max:100'],
            'specific_location'  => ['nullable', 'string', 'max:255'],
            'is_anonymous'       => ['nullable', 'boolean'],
            'complainant_name'   => ['nullable', 'string', 'max:150'],
            'complainant_contact' => [
                'nullable',
                'string',
                'regex:/^09[0-9]{9}$/',
            ],
            'complainant_email'  => ['nullable', 'email', 'max:150'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required'            => 'Enter a title or subject.',
            'title.max'                 => 'Keep the title within 200 characters.',
            'description.required'      => 'Enter a description of the complaint.',
            'description.max'           => 'The description is too long (10,000 characters maximum).',
            'received_channel.required' => 'Choose how the complaint was received.',
            'received_channel.in'       => 'Choose how the complaint was received.',
            'received_at.required'      => 'Enter the date and time the complaint was received.',
            'received_at.date_format'   => 'Enter the date and time the complaint was received.',
            'incident_datetime.date_format' => 'Enter a valid incident date and time, or leave it blank if unknown.',
            'target_date.date_format'   => 'Enter a valid target date.',
            'category_id.exists'        => 'Choose a valid category.',
            'province_id.exists'        => 'Choose a valid province.',
            'complainant_email.email'   => 'Enter a valid email address.',
            'complainant_contact.regex' => 'Contact number must start with 09 and contain exactly 11 digits (e.g., 09876543212).',
            '*.max'                     => 'Maximum :max characters.',
        ];
    }

    public function after(): array
    {
        return [function (\Illuminate\Validation\Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            $tz = self::TZ;
            $received = Carbon::createFromFormat(self::DT, $this->input('received_at'), $tz);

            if ($received->gt(now($tz)->addMinutes(5))) {
                $v->errors()->add('received_at', 'The received date cannot be in the future.');
            }
            if ($this->filled('incident_datetime')) {
                $incident = Carbon::createFromFormat(self::DT, $this->input('incident_datetime'), $tz);
                if ($incident->gt($received)) {
                    $v->errors()->add('incident_datetime', 'The incident cannot be after the received date.');
                }
            }
            if ($this->filled('target_date') && $this->input('target_date') < $received->toDateString()) {
                $v->errors()->add('target_date', 'The target date cannot be before the received date.');
            }
        }];
    }

    /** Validated data, with complainant details dropped for anonymous complaints. */
    public function complaintData(): array
    {
        $d = $this->validated();
        $d['is_anonymous'] = (bool) ($d['is_anonymous'] ?? false);
        $d['priority'] = $d['priority'] ?? 'normal';

        if ($d['is_anonymous']) {
            $d['complainant_name'] = $d['complainant_contact'] = $d['complainant_email'] = null;
        }
        return $d;
    }
}
