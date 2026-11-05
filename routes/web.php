<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Admin\ComplaintController as AdminComplaintController;
use App\Http\Controllers\Admin\ComplaintShowController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\EmailSettingsController;
use App\Http\Controllers\Admin\OfficeController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\AuditController;
use App\Http\Controllers\Field\FieldDashboardController;
use App\Http\Controllers\Field\ComplaintController as FieldComplaintListController;
use App\Http\Controllers\Field\FieldComplaintController;

// Global route patterns
// {id} only matches numbers (must be declared before the routes that use it)
Route::pattern('id', '[0-9]+');

Route::redirect('/', '/login');

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

// Password reset
Route::post('/password/reset', [PasswordResetController::class, 'handle'])
    ->middleware(['guest', 'throttle:10,1'])
    ->name('password.reset.handle');

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
});

/*
|--------------------------------------------------------------------------
| Field office routes (/field/*)
|--------------------------------------------------------------------------
| The active user / active office checks that used to be in the closure
| must now live in the 'field' middleware (or the controller).
| If 'field.office' is a separate middleware, use:
| ['auth', 'field', 'field.office']
*/

Route::middleware(['auth', 'field'])->prefix('field')->name('field.')->group(function () {

    // Dashboard & notifications
    Route::get('/dashboard', [FieldDashboardController::class, 'index'])->name('dashboard');
    Route::post('/notifications/read', [FieldDashboardController::class, 'markNotificationsRead'])
        ->name('notifications.read');

    // Complaints
    Route::get('/complaints', [FieldComplaintListController::class, 'index'])->name('complaints');
    Route::post('/complaints', [FieldComplaintListController::class, 'store'])->name('complaints.store');

    // Complaint view, edit, and workflow actions

        Route::controller(FieldComplaintController::class)->group(function () {
            Route::get('complaints/{id}', 'show')
                ->name('complaints.show');

            Route::post('complaints/{id}/acknowledge', 'acknowledge')
                ->name('complaints.acknowledge');

            Route::post('complaints/{id}/status', 'status')
                ->name('complaints.status');

            Route::post('complaints/{id}/update', 'postUpdate')
                ->name('complaints.update');

            Route::put('complaints/{id}', 'edit')
                ->name('complaints.edit');

            Route::delete('complaints/{id}', 'destroy')
                ->name('complaints.destroy');

            Route::get('documents/{id}', 'document')
                ->name('documents.show');
        });
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
    Route::get('/complaints', [AdminComplaintController::class, 'index'])->name('complaints');
    Route::post('/complaints', [AdminComplaintController::class, 'store'])->name('complaints.store');

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

    // Audit trail
    Route::get('/audit', [AuditController::class, 'index'])
        ->name('admin.audit.index');
});