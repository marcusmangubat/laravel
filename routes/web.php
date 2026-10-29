<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Admin\ComplaintController;
use App\Http\Controllers\Admin\ComplaintShowController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\EmailSettingsController;
use App\Http\Controllers\Admin\OfficeController;
use App\Http\Controllers\Admin\UserController;


// Global route patterns
// {id} only matches numbers (must be declared before the routes that use it)
Route::pattern('id', '[0-9]+');

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');

    Route::post('/login', [LoginController::class, 'login'])
        ->middleware('throttle:5,1')
        ->name('login.submit');
});

Route::post('/logout', [LoginController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

/*
|--------------------------------------------------------------------------
| Authenticated routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth')->group(function () {

    // Redirect to the dashboard that matches the user's role
    Route::get('/dashboard', function () {
        return match (auth()->user()->role) {
            'admin'        => redirect()->route('admin.dashboard'),
            'field_office' => redirect()->route('field.dashboard'),
            default        => abort(403),
        };
    })->name('dashboard');

    // Field office dashboard (active user + active office only)
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

/*
|--------------------------------------------------------------------------
| Admin routes (/admin/*)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth', 'admin'])->prefix('admin')->group(function () {

    // Dashboard & notifications
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('admin.dashboard');
    Route::post('/notifications/read', [DashboardController::class, 'markNotificationsRead'])
        ->name('admin.notifications.read');

    // Complaints: list & create
    Route::get('/complaints', [ComplaintController::class, 'index'])->name('complaints');
    Route::post('/complaints', [ComplaintController::class, 'store'])->name('complaints.store');

    // Complaints: view, edit, delete, and workflow actions
    Route::controller(ComplaintShowController::class)->group(function () {
        Route::get('complaints/{id}', 'show');
        Route::put('complaints/{id}', 'update');
        Route::delete('complaints/{id}', 'destroy');

        Route::post('complaints/{id}/status', 'status');
        Route::post('complaints/{id}/assign', 'assign');
        Route::post('complaints/{id}/updates', 'postUpdate');

        Route::get('documents/{id}', 'document');
    });

    // Office directory
    Route::get('/offices', [OfficeController::class, 'index'])->name('admin.offices');

    // Email settings
    Route::get('/email-settings', [EmailSettingsController::class, 'index'])
        ->name('admin.email-settings');
    Route::put('/email-settings', [EmailSettingsController::class, 'update'])
        ->name('admin.email-settings.update');
    Route::post('/email-settings/test', [EmailSettingsController::class, 'sendTestEmail'])
        ->name('admin.email-settings.test');

    // Users
    Route::get('/users', [UserController::class, 'index'])->name('admin.users');
    Route::post('/users', [UserController::class, 'store'])->name('admin.users.store');
    Route::patch('/users/{id}/status', [UserController::class, 'updateStatus'])->name('admin.users.status');
});