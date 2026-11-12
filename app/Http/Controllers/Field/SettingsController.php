<?php

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $u = $request->user();

        $office = DB::table('offices as o')
            ->leftJoin('provinces as p', 'p.province_id', '=', 'o.province_id')
            ->leftJoin('offices as parent', 'parent.office_id', '=', 'o.parent_office_id')
            ->where('o.office_id', $u->office_id)
            ->first(['o.office_name', 'o.office_code', 'o.office_type',
                     'p.province_name', 'parent.office_name as parent_name']);

        return Inertia::render('field/settings', [
            'profile' => [
                'username'       => $u->username,
                'email'          => $u->email,
                'full_name'      => $u->full_name,
                'position_title' => $u->position_title ?? '',
                'contact_number' => $u->contact_number ?? '',
            ],
            'office'   => $office,
            'activity' => [
                'last_login_at'       => $u->last_login_at?->format('Y-m-d H:i:s'),
                'password_changed_at' => $u->password_changed_at?->format('Y-m-d H:i:s'),
            ],
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        $v = $request->validate([
            'full_name'      => ['required', 'string', 'max:150'],
            'position_title' => ['nullable', 'string', 'max:120'],
            'contact_number' => [
                'nullable',
                'string',
                'regex:/^09[0-9]{9}$/',
            ],
        ], [
            'full_name.required'     => 'Enter your full name.',
            'full_name.max'          => 'Keep the name within 150 characters.',
            'position_title.max'     => 'Keep the position within 120 characters.',
            'contact_number.regex' => 'Contact number must start with 09 and contain exactly 11 digits (e.g., 09876543212).',
        ]);

        $new = [
            'full_name'      => trim($v['full_name']),
            'position_title' => trim((string) ($v['position_title'] ?? '')) ?: null,
            'contact_number' => trim((string) ($v['contact_number'] ?? '')) ?: null,
        ];

        $old = $user->only(array_keys($new));
        $changed = array_filter(
            $new,
            fn ($val, $k) => (string) ($old[$k] ?? '') !== (string) ($val ?? ''),
            ARRAY_FILTER_USE_BOTH
        );

        if ($changed) {
            $user->update($new);

            DB::table('audit_logs')->insert([
                'user_id'     => $user->user_id,
                'action'      => 'profile_updated',
                'entity_type' => 'users',
                'entity_id'   => $user->user_id,
                'old_values'  => json_encode(array_intersect_key($old, $changed)),
                'new_values'  => json_encode($changed),
                'ip_address'  => $request->ip(),
                'user_agent'  => substr((string) $request->userAgent(), 0, 255),
                'created_at'  => now(),
            ]);
        }

        return back()->with('success', 'Your profile was updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        $v = $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'string', 'max:72', 'confirmed',
                                   Password::min(8)->mixedCase()->numbers()->symbols()],
        ], [
            'current_password.required' => 'Enter your current password.',
            'password.required'         => 'Enter a new password.',
            'password.confirmed'        => 'The new passwords do not match.',
            'password.max'              => 'Keep the password within 72 characters.',
        ]);

        if (! Hash::check($v['current_password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'current_password' => 'The current password is incorrect.',
            ]);
        }

        if (Hash::check($v['password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'password' => 'Choose a password different from your current one.',
            ]);
        }

        $user->forceFill([
            'password_hash'         => Hash::make($v['password']),
            'must_change_password'  => false,
            'password_changed_at'   => now(),
            'failed_login_attempts' => 0,
            'locked_until'          => null,
        ])->save();

        DB::table('audit_logs')->insert([
            'user_id'     => $user->user_id,
            'action'      => 'password_changed',
            'entity_type' => 'users',
            'entity_id'   => $user->user_id,
            'new_values'  => json_encode(['via' => 'settings']),
            'ip_address'  => $request->ip(),
            'user_agent'  => substr((string) $request->userAgent(), 0, 255),
            'created_at'  => now(),
        ]);

        return back()->with('success', 'Your password was changed.');
    }
}