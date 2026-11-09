<?php
// app/Http/Controllers/Admin/UserController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AccountCredentialsMailer;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    private const PER_PAGE = 10;

    /**
     * Replaces: users.php (page) + ajax/users_list.php.
     * Lists field-office accounts only (admin accounts are never shown here).
     */
    public function index(Request $request): Response|RedirectResponse
    {
        $f = $request->validate([
            'q'         => ['nullable', 'string', 'max:100'],
            'office_id' => ['nullable', 'integer', 'exists:offices,office_id'],
            'is_active' => ['nullable', 'in:0,1'],
            'page'      => ['nullable', 'integer', 'min:1'],
        ]);

        $users = DB::table('users as u')
            ->leftJoin('offices as o', 'o.office_id', '=', 'u.office_id')
            ->where('u.role', 'field_office')

            ->when($f['q'] ?? null, function ($query, $term) {
                $like = '%' . addcslashes($term, '%_\\') . '%';
                $query->where(fn ($w) => $w
                    ->where('u.username', 'like', $like)
                    ->orWhere('u.full_name', 'like', $like)
                    ->orWhere('u.email', 'like', $like)
                    ->orWhere('o.office_name', 'like', $like));
            })
            ->when($f['office_id'] ?? null, fn ($q, $v) => $q->where('u.office_id', $v))
            // "0" (Deactivated) is a real choice, so compare with null instead of relying on truthiness.
            ->when(($f['is_active'] ?? null) !== null, fn ($q) => $q->where('u.is_active', (int) $f['is_active']))

            ->orderByDesc('u.is_active')
            ->orderBy('u.full_name')
            ->orderBy('u.user_id')

            // password_hash is deliberately NOT selected: it never leaves the server.
            ->select([
                'u.user_id', 'u.username', 'u.email', 'u.full_name', 'u.position_title',
                'u.contact_number', 'u.is_active', 'u.must_change_password',
                'u.last_login_at', 'u.created_at',
                'o.office_name', 'o.office_code',
                DB::raw('(u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS is_locked'),
            ])
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(function ($r) {
                $r->is_active            = (int) $r->is_active;
                $r->is_locked            = (int) $r->is_locked;
                $r->must_change_password = (int) $r->must_change_password;
                return $r;
            });

        if ($users->currentPage() > $users->lastPage()) {
            return redirect()->route('admin.users', array_merge(
                $request->query(),
                ['page' => $users->lastPage()]
            ));
        }

        return Inertia::render('admin/users', [
            'users'   => $users,
            'filters' => [
                'q'         => $f['q'] ?? '',
                'office_id' => $f['office_id'] ?? '',
                'is_active' => $f['is_active'] ?? '',
            ],
            'offices' => fn () => DB::table('offices')->where('is_active', 1)
                ->orderBy('office_name')->get(['office_id', 'office_name', 'office_code']),
        ]);
    }

    /** Replaces: ajax/user_create.php. Validation lives in StoreUserRequest. */
        public function store(StoreUserRequest $request, AccountCredentialsMailer $credentialsMailer): RedirectResponse
    {
        $v     = $request->validated();
        $admin = $request->user();

        try {
            $user = DB::transaction(function () use ($v, $admin, $request) {
                $user = User::create([
                    'office_id'            => $v['office_id'],
                    'role'                 => 'field_office',      // set here, never taken from the form
                    'username'             => $v['username'],
                    'email'                => $v['email'],
                    'password_hash'        => Hash::make($v['password']),   // bcrypt, same format as password_hash()
                    'full_name'            => $v['full_name'],
                    'position_title'       => $v['position_title'] ?? null,
                    'contact_number'       => $v['contact_number'] ?? null,
                    'is_active'            => true,
                    'must_change_password' => true,               // forces a new password at first sign-in
                    'created_by'           => $admin->user_id,
                ]);

                AuditLog::create([
                    'user_id'     => $admin->user_id,
                    'action'      => 'field_user_created',
                    'entity_type' => 'users',
                    'entity_id'   => $user->user_id,
                    'new_values'  => ['username' => $v['username'], 'email' => $v['email'], 'office_id' => (int) $v['office_id']],
                    'ip_address'  => $request->ip(),
                    'user_agent'  => substr((string) $request->userAgent(), 0, 255),
                ]);

                return $user;
            });
        } catch (QueryException $e) {
            // Two admins creating the same username at the same moment: the database unique
            // key is the final guard. 1062 = "duplicate entry".
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                $field = str_contains($e->getMessage(), 'email') ? 'email' : 'username';
                throw ValidationException::withMessages([$field => "This {$field} is already in use."]);
            }
            throw $e;
        }

                $officeName = DB::table('offices')->where('office_id', $v['office_id'])->value('office_name');

        // Runs after the transaction has committed. A mail failure never undoes the account.
        $result = $credentialsMailer->send($user, $v['password'], $officeName, $request);

        return back()->with('success', $result['ok']
            ? "Account \"{$user->username}\" was created for {$officeName}. "
              . "The login details were emailed to {$user->email}. They must change the password at first sign-in."
            : "Account \"{$user->username}\" was created for {$officeName}, but the email to {$user->email} "
              . "could not be sent ({$result['message']}). Share the temporary password privately. "
              . 'They must change it at first sign-in.');
    }

    /** Replaces: ajax/user_status.php. Activate or deactivate a field-office account. */
    public function updateStatus(Request $request, int $id): RedirectResponse
    {
        $v = $request->validate(['is_active' => ['required', 'in:0,1']]);
        $active = (int) $v['is_active'];

        // Only field-office accounts can be changed here (404 for anything else).
        $user = User::where('role', 'field_office')->findOrFail($id);

        DB::transaction(function () use ($user, $active, $request) {
            $user->update([
                'is_active'             => $active,
                'failed_login_attempts' => 0,      // activating also clears any lockout
                'locked_until'          => null,
            ]);

            AuditLog::create([
                'user_id'     => $request->user()->user_id,
                'action'      => $active ? 'field_user_activated' : 'field_user_deactivated',
                'entity_type' => 'users',
                'entity_id'   => $user->user_id,
                'new_values'  => ['username' => $user->username, 'is_active' => $active],
                'ip_address'  => $request->ip(),
                'user_agent'  => substr((string) $request->userAgent(), 0, 255),
            ]);
        });

        return back()->with('success', $active
            ? "Account \"{$user->username}\" is now active."
            : "Account \"{$user->username}\" has been deactivated.");
    }
}