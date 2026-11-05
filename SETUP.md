# Setup notes

1. **bootstrap/app.php** – register middleware alias:
   `$middleware->alias(['field' => \App\Http\Middleware\EnsureFieldOffice::class]);`
2. **routes/web.php** – add `require __DIR__.'/field.php';`
3. **.env / config**
    - `SESSION_LIFETIME=30` (replaces SESSION_TIMEOUT_SEC = 1800; Laravel expires idle sessions itself)
    - `config/app.php`: `'timezone' => 'Asia/Manila'`
    - `SESSION_SAME_SITE=strict`, `SESSION_SECURE_COOKIE=true` in production
4. **app/Http/Middleware/HandleInertiaRequests.php** – share user/office for the layout:
    ```php
    public function share(Request $request): array
    {
        $office = $request->attributes->get('office');
        return [
            ...parent::share($request),
            'auth' => ['user' => $request->user() ? [
                'full_name'   => $request->user()->full_name,
                'office_name' => $office->office_name ?? null,
            ] : null],
        ];
    }
    ```
    Note: global web middleware runs before route middleware, so `office` may be null on the first
    pass; if so, query the office name inside `share()` instead (or move EnsureFieldOffice earlier).
5. **resources/views/app.blade.php** `<head>` – add Font Awesome + DM Sans/DM Serif fonts, and
   in `resources/css/app.css`: `.serif { font-family: 'DM Serif Display', serif; }`
   and `.skeleton { background:#e2e8f0; animation: pulse 1.4s ease-in-out infinite; }`
   (Tailwind is already bundled by Breeze – drop the CDN script.)
6. Copy `public/pictures/logo.jpg`.
7. Security headers (X-Frame-Options, nosniff, Referrer-Policy, no-store) -> small middleware or web server config.
8. **Name clash:** Laravel ships its own `notifications` table (UUID id, `notifiable_*`). Yours has `user_id` + `is_read`.
   Don't publish/run Laravel's notifications migration.
9. Users table uses `user_id` as PK – set `protected $primaryKey = 'user_id';` on the User model.
10. `route()` in the React page needs Ziggy (included with Breeze React).
