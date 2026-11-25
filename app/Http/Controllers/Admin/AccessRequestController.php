<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountCredentialsMailer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Admin review of field-office access requests.
 */
class AccessRequestController extends Controller
{
    /**
     * Pending requests as JSON, shown in the "Pending access requests" panel
     * on the Field Office Accounts page (admin/users.tsx).
     */
    public function pending()
    {
        $rows = DB::table('access_requests as r')
            ->leftJoin('offices as o', 'o.office_id', '=', 'r.office_id')
            ->where('r.status', 'pending')
            ->orderBy('r.created_at')
            ->limit(50)
            ->get([
                'r.request_id', 'r.office_id', 'o.office_name', 'o.office_code',
                'r.full_name', 'r.username', 'r.email',
                'r.position_title', 'r.contact_number', 'r.created_at',
            ]);

        return response()->json(['requests' => $rows]);
    }

    public function approve(Request $request, int $id, AccountCredentialsMailer $credentialsMailer)
    {
        // The admin may correct any prefilled value before approving.
        $data = $request->validate([
            'office_id' => ['required', 'integer', Rule::exists('offices', 'office_id')->where('is_active', 1)],
            'full_name' => ['required', 'string', 'max:150'],
            'username' => ['required', 'string', 'max:60', 'regex:/^[A-Za-z0-9._]+$/', Rule::unique('users', 'username')],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')],
            'position_title' => ['required', 'string', 'max:120'],
            'contact_number' => ['required', 'digits:11'],
            'password' => ['required', 'string', 'min:10', 'max:72', 'confirmed', 'regex:/[A-Za-z]/', 'regex:/\d/'],
        ], [
            'password.regex' => 'The password needs at least one letter and one number.',
            'contact_number.digits' => 'Enter an 11-digit number, e.g. 09XXXXXXXXX.',
        ]);

        $admin = $request->user();

        $userId = DB::transaction(function () use ($id, $data, $admin, $request) {
            $req = DB::table('access_requests')->where('request_id', $id)->lockForUpdate()->first();

            if (! $req || $req->status !== 'pending') {
                throw ValidationException::withMessages(['form' => 'This request has already been processed.']);
            }

            $userId = DB::table('users')->insertGetId([
                'office_id' => $data['office_id'],
                'role' => 'field_office',
                'username' => $data['username'],
                'email' => $data['email'],
                'password_hash' => Hash::make($data['password']),
                'full_name' => $data['full_name'],
                'position_title' => $data['position_title'],
                'contact_number' => $data['contact_number'],
                'is_active' => 1,
                'must_change_password' => 1,
                'created_by' => $admin->user_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('access_requests')->where('request_id', $id)->update([
                'status' => 'approved',
                'reviewed_by' => $admin->user_id,
                'reviewed_at' => now(),
                'created_user_id' => $userId,
                'updated_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'user_id' => $admin->user_id,
                'action' => 'access_request_approved',
                'entity_type' => 'access_requests',
                'entity_id' => $id,
                'new_values' => json_encode([
                    'username' => $data['username'],
                    'email' => $data['email'],
                    'office_id' => $data['office_id'],
                    'created_user_id' => $userId,
                ]),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'created_at' => now(),
            ]);

            return $userId;
        });

        $user = User::findOrFail($userId);
        $officeName = DB::table('offices')->where('office_id', $data['office_id'])->value('office_name');
        $result = $credentialsMailer->send($user, $data['password'], $officeName, $request);

        return back()->with('success', $result['ok']
            ? "Account \"{$user->username}\" was created for {$officeName}. "
              ."The login details were emailed to {$user->email}. They must change the password at first sign-in."
            : "Account \"{$user->username}\" was created for {$officeName}, but the email to {$user->email} "
              ."could not be sent ({$result['message']}). Share the temporary password privately. "
              .'They must change it at first sign-in.');
    }

    public function reject(Request $request, int $id)
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($id, $data, $request) {
            $req = DB::table('access_requests')->where('request_id', $id)->lockForUpdate()->first();

            if (! $req || $req->status !== 'pending') {
                throw ValidationException::withMessages(['form' => 'This request has already been processed.']);
            }

            DB::table('access_requests')->where('request_id', $id)->update([
                'status' => 'rejected',
                'reviewed_by' => $request->user()->user_id,
                'reviewed_at' => now(),
                'reject_reason' => $data['reason'],
                'updated_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'user_id' => $request->user()->user_id,
                'action' => 'access_request_rejected',
                'entity_type' => 'access_requests',
                'entity_id' => $id,
                'new_values' => json_encode(['reason' => $data['reason']]),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'created_at' => now(),
            ]);
        });

        return back()->with('success', 'The access request was rejected.');
    }
}
