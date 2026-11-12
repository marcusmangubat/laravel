<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class LoginController extends Controller
{
    // Display the React login page
    public function show()
    {
        return Inertia::render('auth/login');
    }

    // Process the login form
    public function login(Request $request)
    {
        // 1. Validate the submitted information
        $data = $request->validate([
            'login' => ['required', 'string', 'max:150'],
            'password' => ['required', 'string'],
        ]);

        // 2. Find the account by username or email
        $user = User::where('username', $data['login'])
            ->orWhere('email', $data['login'])
            ->first();

        $error = [
            'login' => 'Invalid credentials or account unavailable.',
        ];

        // 3. Check whether the account exists
        if (!$user) {
            return back()->withErrors($error);
        }

        // 4. Check whether the account is locked
        if ($user->locked_until && $user->locked_until->isFuture()) {
            return back()->withErrors($error);
        }

        // 5. Verify the password against its stored hash
        if (!Hash::check($data['password'], $user->password_hash)) {
            return back()->withErrors($error);
        }

        // 6. Check account status
        if (!$user->is_active) {
            return back()->withErrors($error);
        }

        // 7. Check the role and assigned office
        if (!in_array($user->role, ['admin', 'field_office'], true)) {
            return back()->withErrors($error);
        }

        if ($user->role === 'field_office') {
            $officeActive = DB::table('offices')
                ->where('office_id', $user->office_id)
                ->where('is_active', 1)
                ->exists();

            if (!$officeActive) {
                return back()->withErrors($error);
            }
        }

        // Temporary safeguard until password-change flow exists
         if ($user->must_change_password) {
            $user->forceFill(['failed_login_attempts' => 0])->save();

            return redirect()->route('login')->with('force_reset', $user->username);
        }

        // 8. Create an authenticated Laravel session
        Auth::login($user);
        $request->session()->regenerate();
        Inertia::clearHistory();

        // 9. Record the successful login
        $user->forceFill([
            'last_login_at' => now(),
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();

        // 10. Redirect based on the account's role
        return redirect()->route(
            $user->role === 'admin'
                ? 'admin.dashboard'
                : 'field.dashboard'
        );
    }

    // Log out
    public function logout(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        Inertia::clearHistory(); // wipes Inertia's saved pages (Inertia v2)

        return Inertia::location(route('login')); // full page reload, no cached state
    }
}
