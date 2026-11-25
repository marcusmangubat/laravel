<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Public (guest) side of the "Request Access" flow.
 */
class AccessRequestController extends Controller
{
    public function create()
    {
        return Inertia::render('auth/request-access', [
            'offices' => DB::table('offices')
                ->where('is_active', 1)
                ->where('office_type', '!=', 'regional')
                ->orderBy('office_name')
                ->get(['office_id', 'office_name', 'office_code']),
        ]);
    }

    public function store(Request $request)
    {
        // Honeypot: real users never fill this hidden field.
        if ($request->filled('website')) {
            return back()->with('success', 'Your request has been submitted.');
        }

        $data = $request->validate([
            'office_id' => ['required', 'integer', Rule::exists('offices', 'office_id')->where('is_active', 1)],
            'full_name' => ['required', 'string', 'max:150'],
            'username' => [
                'required', 'string', 'max:60', 'regex:/^[A-Za-z0-9._]+$/',
                Rule::unique('users', 'username'),
                Rule::unique('access_requests', 'username')->where('status', 'pending'),
            ],
            'email' => [
                'required', 'email', 'max:150',
                Rule::unique('users', 'email'),
                Rule::unique('access_requests', 'email')->where('status', 'pending'),
            ],
            'position_title' => ['required', 'string', 'max:120'],
            'contact_number' => ['required', 'digits:11'],
        ], [
            'username.unique' => 'This username is already taken or already has a pending request.',
            'email.unique' => 'This email already has an account or a pending request.',
            'username.regex' => 'Use only letters, numbers, periods and underscores.',
            'contact_number.digits' => 'Enter an 11-digit number, e.g. 09XXXXXXXXX.',
        ]);

        DB::transaction(function () use ($data, $request) {
            $id = DB::table('access_requests')->insertGetId([
                ...$data,
                'status' => 'pending',
                'ip_address' => $request->ip(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'user_id' => null,
                'action' => 'access_requested',
                'entity_type' => 'access_requests',
                'entity_id' => $id,
                'new_values' => json_encode([
                    'username' => $data['username'],
                    'email' => $data['email'],
                    'office_id' => $data['office_id'],
                ]),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'created_at' => now(),
            ]);

            // Notify every active admin (shows in the notification bell).
            $admins = DB::table('users')->where('role', 'admin')->where('is_active', 1)->pluck('user_id');
            foreach ($admins as $adminId) {
                DB::table('notifications')->insert([
                    'user_id' => $adminId,
                    'complaint_id' => null,
                    'notif_type' => 'system',
                    'message' => "New access request from {$data['full_name']} ({$data['username']}).",
                    'created_at' => now(),
                ]);
            }
        });

        return back()->with('success', 'Your request has been submitted. An administrator will review it.');
    }
}
