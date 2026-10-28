# Laravel Email Settings starter

This is a starter conversion of the old `admin/email-settings.php` page for a Laravel + Inertia React application.

## Files
- `app/Http/Controllers/Admin/EmailSettingsController.php`
- `app/Services/EmailSettingsCrypto.php`
- `app/Services/EmailSettingsService.php`
- `resources/js/pages/admin/email-settings.tsx`

## 1. Install PHPMailer
From your Laravel project directory:

```bash
composer require phpmailer/phpmailer
```

## 2. Configure the existing encryption key
Add to `config/services.php`:

```php
'email_settings' => [
    'key' => env('EMAIL_SETTINGS_ENCRYPTION_KEY'),
],
```

Add `EMAIL_SETTINGS_ENCRYPTION_KEY` to `.env` using the existing Base64-encoded 32-byte key from the old application's `config/secret.php`. Do not commit `.env`. Since the key was shared in chat, consider rotating it carefully after decrypting/re-encrypting existing stored passwords.

## 3. Add routes
Import the controller in `routes/web.php`:

```php
use App\Http\Controllers\Admin\EmailSettingsController;
```

Inside your existing `Route::middleware(['auth', 'admin'])->prefix('admin')->group(...)` group, add:

```php
Route::get('/email-settings', [EmailSettingsController::class, 'index'])
    ->name('admin.email-settings');
Route::put('/email-settings', [EmailSettingsController::class, 'update'])
    ->name('admin.email-settings.update');
Route::post('/email-settings/test', [EmailSettingsController::class, 'sendTestEmail'])
    ->name('admin.email-settings.test');
```

Do not add a second overlapping admin middleware group if you can place these inside your current one.

## 4. Ensure Laravel's CSRF meta tag exists
Your main Blade layout should include:

```html
<meta name="csrf-token" content="{{ csrf_token() }}">
```

## 5. React route helper
The TSX uses `route('...')`, which assumes Ziggy is configured in your project. If your project does not use Ziggy, replace:
- `route('admin.email-settings.update')` with `/admin/email-settings`
- `route('admin.email-settings.test')` with `/admin/email-settings/test`

## 6. Check your User model
Your database uses `users.user_id` as its primary key. Ensure `App\Models\User` declares:

```php
protected $primaryKey = 'user_id';
```

If your existing authentication setup already handles this, do not duplicate it.

## Notes
- The controller never sends the SMTP password to React.
- Leaving the password blank preserves the saved encrypted value.
- Audit log entries match the supplied `audit_logs` columns.
- Test emails use the saved configuration, as the old PHP page did.
- Review this starter against your Laravel version and existing middleware/layout before deployment.
