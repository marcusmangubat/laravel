<?php
// app/Http/Middleware/EnsureFieldOffice.php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Replaces the access-control block at the top of field/dashboard.php
 * and the "re-check account and office in the database" part of field/ajax/dashboard_data.php.
 *
 * Laravel loads the user from the database on every request, so is_active and the
 * office are always fresh. Nothing about the office ever comes from the browser.
 */
class EnsureFieldOffice
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'field_office') {
            abort(403);
        }

        $office = $user->office;   // relationship defined in the User model

        if (!$user->is_active || !$office || !$office->is_active) {
            abort(403, 'Your account is not authorized to view this dashboard. Contact the RDAC Administrator.');
        }

        return $next($request);
    }
}