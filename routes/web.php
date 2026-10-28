<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ComplaintController;
use App\Http\Controllers\Admin\StoreComplaintRequest;
use App\Http\Controllers\Admin\ComplaintShowController;
use App\Http\Controllers\Admin\ComplaintWorkflow;
use App\Http\Controllers\Admin\EmailSettingsController;

// Login page
Route::get('/login', [LoginController::class, 'show'])
    ->middleware('guest')
    ->name('login');

// Submit login credentials
Route::post('/login', [LoginController::class, 'login'])
    ->middleware(['guest', 'throttle:5,1'])
    ->name('login.submit');

// Logout
Route::post('/logout', [LoginController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

// Protected pages
Route::middleware('auth')->group(function () {

    Route::get('/dashboard', function () {
        $user = auth()->user();

        return match ($user->role) {
            'admin' => redirect()->route('admin.dashboard'),
            'field_office' => redirect()->route('field.dashboard'),
            default => abort(403),
        };
    })->name('dashboard');

    Route::middleware(['auth', 'verified'])   // use whatever your admin group already uses
    ->prefix('admin')
    ->group(function () {
        // ...your existing GET /admin/complaints and POST /admin/complaints stay as they are

        Route::controller(ComplaintShowController::class)->group(function () {
            Route::get('complaints/{id}', 'show');
            Route::put('complaints/{id}', 'update');
            Route::delete('complaints/{id}', 'destroy');

            Route::post('complaints/{id}/status', 'status');
            Route::post('complaints/{id}/assign', 'assign');
            Route::post('complaints/{id}/updates', 'postUpdate');

            Route::get('documents/{id}', 'document');
        });
    });

    Route::get('admin/email-settings', [EmailSettingsController::class, 'index'])
    ->name('admin.email-settings');
    Route::put('admin/email-settings', [EmailSettingsController::class, 'update'])
        ->name('admin.email-settings.update');
    Route::post('admin/email-settings/test', [EmailSettingsController::class, 'sendTestEmail'])
        ->name('admin.email-settings.test');

        
    // Make sure {id} only matches numbers, so it never clashes with other complaint routes
    Route::pattern('id', '[0-9]+');

    Route::get('/admin/dashboard', function () {
        $user = auth()->user();

        abort_unless(
            $user->role === 'admin' && $user->is_active,
            403
        );

        return Inertia::render('admin/dashboard');
    })->name('admin.dashboard');

    Route::get('/field/dashboard', function () {
        $user = auth()->user();

        abort_unless(
            $user->role === 'field_office' &&
            $user->is_active &&
            DB::table('offices')
                ->where('office_id', $user->office_id)
                ->where('is_active', 1)
                ->exists(),
            403
        );

        return Inertia::render('field/dashboard');
    })->name('field.dashboard');
});

    Route::middleware(['auth', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('admin.dashboard');
    Route::post('/notifications/read', [DashboardController::class, 'markNotificationsRead'])
        ->name('admin.notifications.read');
    Route::get('/complaints', [ComplaintController::class, 'index'])
    ->name('complaints');

    Route::post('/complaints', [ComplaintController::class, 'store'])
        ->name('complaints.store');
});

