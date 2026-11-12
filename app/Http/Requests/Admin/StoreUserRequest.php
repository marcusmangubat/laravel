<?php
// app/Http/Requests/Admin/StoreUserRequest.php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /** Emails are stored in lowercase (like your mb_strtolower), before the rules run. */
    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => mb_strtolower((string) $this->input('email'))]);
        }
    }

    public function rules(): array
    {
        return [
            // The office must exist and be active
            'office_id' => ['required', 'integer', Rule::exists('offices', 'office_id')->where('is_active', 1)],

            'full_name'      => ['required', 'string', 'max:150'],
            'position_title' => ['nullable', 'string', 'max:120'],
            'contact_number' => [
                'required',
                'string',
                'regex:/^09[0-9]{9}$/',
            ],

            // unique:users,username  =  "SELECT 1 FROM users WHERE username = ?" from your old code
            'username' => [
                'required', 'string', 'min:3', 'max:60',
                'regex:/^[A-Za-z0-9._]+$/',
                Rule::unique('users', 'username'),
            ],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')],

            // At least 10 characters, one letter and one number
            'password' => [
                'required', 'string', 'min:10', 'max:72',
                'regex:/[A-Za-z]/',
                'regex:/\d/',
            ],
            // "password_confirmation" is the name Laravel expects; it is also exempt from trimming
            'password_confirmation' => ['required_with:password', 'same:password'],
        ];
    }

    public function messages(): array
    {
        return [
            'office_id.required' => 'Choose the field office this account belongs to.',
            'office_id.integer'  => 'Choose the field office this account belongs to.',
            'office_id.exists'   => 'Choose an active office.',

            'full_name.required' => 'Enter the person’s full name.',
            'full_name.max'      => 'Keep the name within 150 characters.',
            'position_title.max' => 'Keep the position within 120 characters.',
            'contact_number.max' => 'Keep the contact number within 50 characters.',

            'username.required'  => 'Enter a username.',
            'username.min'       => 'Username must be 3–60 characters.',
            'username.max'       => 'Username must be 3–60 characters.',
            'username.regex'     => 'Use only letters, numbers, periods and underscores.',
            'username.unique'    => 'This username is already in use.',

            'email.required'     => 'Enter an email address.',
            'email.email'        => 'Enter a valid email address.',
            'email.max'          => 'Enter a valid email address.',
            'email.unique'       => 'This email is already in use.',

            'password.required'  => 'Set a temporary password.',
            'password.min'       => 'Use at least 10 characters.',
            'password.max'       => 'Keep the password within 72 characters.',
            'password.regex'     => 'Include at least one letter and one number.',

            'password_confirmation.required_with' => 'The passwords do not match.',
            'password_confirmation.same'          => 'The passwords do not match.',
        ];
    }
}