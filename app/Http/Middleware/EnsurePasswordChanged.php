<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

// Safety net: if an already-logged-in user gets must_change_password set
// (e.g. admin resets their password), kick them to the same Login.tsx flow.
// Add to the 'auth' route groups: ->middleware(['auth', 'password.changed', ...])
// Register: $middleware->alias(['password.changed' => EnsurePasswordChanged::class]);
class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            $username = $user->username;

            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->with('force_reset', $username);
        }

        return $next($request);
    }
}
