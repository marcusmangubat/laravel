<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\EmailSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Throwable;

class PasswordResetController extends Controller
{
    private const TTL_SECONDS = 300;
    private const RESEND_COOLDOWN = 60;
    private const MAX_ATTEMPTS = 5;

    public function __construct(
        private EmailSettingsService $mailer
    ) {
    }

    public function handle(Request $request): JsonResponse
    {
        return match ($request->input('action')) {
            'request', 'resend' => $this->sendCode($request),
            'verify' => $this->verify($request),
            'save' => $this->save($request),
            default => $this->fail('Invalid request.'),
        };
    }

    private function sendCode(Request $request): JsonResponse
    {
        $request->validate([
            'identifier' => ['required', 'string', 'max:150'],
        ]);

        $generic = 'If that account exists, a 6-digit code was sent to its registered email.';

        $user = $this->findUser($request->input('identifier'));

        if (! $user || ! $user->email) {
            return response()->json([
                'ok' => true,
                'message' => $generic,
            ]);
        }

        // Load the SMTP settings saved in the admin panel.
        $settings = DB::table('email_settings')
            ->where('id', 1)
            ->first();

        if (! $settings) {
            return $this->fail(
                'Email settings have not been configured. Please contact the system administrator.',
                500
            );
        }

        $settings = (array) $settings;

        // Prevent repeated requests.
        if (! Cache::add(
            $this->key($user, 'cooldown'),
            1,
            self::RESEND_COOLDOWN
        )) {
            return $this->fail(
                'Please wait a minute before requesting another code.',
                429
            );
        }

        $code = (string) random_int(100000, 999999);

        Cache::put($this->key($user, 'code'), [
            'hash' => hash_hmac('sha256', $code, config('app.key')),
            'attempts' => 0,
            'expires' => now()->addSeconds(self::TTL_SECONDS)->timestamp,
        ], self::TTL_SECONDS);

        try {
            $html = '
                <p>Hello,</p>
                <p>You requested to change your password for the DENR RDAC Complaint Management System.</p>
                <p>Your verification code is:</p>
                <h2 style="letter-spacing: 5px;">' . $code . '</h2>
                <p>This code expires in 5 minutes.</p>
                <p>If you did not request this, you can ignore this email.</p>
            ';

            // Use the same mail service and database SMTP settings
            // as the Admin Email Settings test email.
            $result = $this->mailer->send(
                $settings,
                $user->email,
                $user->username ?? 'User',
                'Your password change verification code',
                $html
            );

            if (! $result['ok']) {
                Cache::forget($this->key($user, 'code'));
                Cache::forget($this->key($user, 'cooldown'));

                report(new \RuntimeException(
                    'Password reset email failed: ' . $result['message']
                ));

                return $this->fail(
                    $result['message'] ?: 'The verification code could not be sent. Please try again later.',
                    500
                );
            }

        } catch (Throwable $e) {
            report($e);

            Cache::forget($this->key($user, 'code'));
            Cache::forget($this->key($user, 'cooldown'));

            return $this->fail(
                'The verification code could not be sent. Please try again later.',
                500
            );
        }

        return response()->json([
            'ok' => true,
            'message' => $generic,
        ]);
    }

    private function verify(Request $request): JsonResponse
    {
        $request->validate([
            'identifier' => ['required', 'string'],
            'code' => ['required', 'digits:6'],
        ]);

        $user = $this->findUser($request->input('identifier'));

        if (! $user || ! $this->codeIsValid($user, $request->input('code'))) {
            return $this->fail('That code is incorrect or has expired.');
        }

        return response()->json([
            'ok' => true,
            'message' => 'Code verified. Enter your new password.',
        ]);
    }

    private function save(Request $request): JsonResponse
    {
        $request->validate([
            'identifier' => ['required', 'string'],
            'code' => ['required', 'digits:6'],
            'new_password' => [
                'required',
                'confirmed:confirm_password',
                Password::min(8)->mixedCase()->numbers()->symbols(),
            ],
            'confirm_password' => ['required'],
        ]);

        $user = $this->findUser($request->input('identifier'));

        if (! $user || ! $this->codeIsValid($user, $request->input('code'))) {
            return $this->fail('That code is incorrect or has expired.');
        }

        $user->forceFill([
            'password_hash'         => Hash::make($request->input('new_password')),
            'must_change_password'  => 0,
            'password_changed_at'   => now(),
            'failed_login_attempts' => 0,
            'locked_until'          => null,
        ])->save();

        Cache::forget($this->key($user, 'code'));
        Cache::forget($this->key($user, 'cooldown'));

        return response()->json([
            'ok' => true,
            'message' => 'Your password was changed. You can now sign in.',
        ]);
    }

    private function codeIsValid(User $user, string $code): bool
    {
        $entry = Cache::get($this->key($user, 'code'));

        if (! $entry || $entry['expires'] < now()->timestamp) {
            return false;
        }

        if ($entry['attempts'] >= self::MAX_ATTEMPTS) {
            Cache::forget($this->key($user, 'code'));
            return false;
        }

        $ok = hash_equals(
            $entry['hash'],
            hash_hmac('sha256', $code, config('app.key'))
        );

        if (! $ok) {
            $entry['attempts']++;

            Cache::put(
                $this->key($user, 'code'),
                $entry,
                $entry['expires'] - now()->timestamp
            );
        }

        return $ok;
    }

    private function findUser(string $identifier): ?User
    {
        $identifier = trim($identifier);

        return User::where('username', $identifier)
            ->orWhere('email', $identifier)
            ->first();
    }

    private function key(User $user, string $suffix): string
    {
        return "pwreset:{$user->getKey()}:{$suffix}";
    }

    private function fail(string $message, int $status = 422): JsonResponse
    {
        return response()->json([
            'ok' => false,
            'message' => $message,
        ], $status);
    }
}
