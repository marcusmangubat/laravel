<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountCredentialsMailer
{
    public function __construct(private EmailSettingsService $mailer)
    {
    }

    /** @return array{ok: bool, message: string} */
    public function send(User $user, string $plainPassword, ?string $officeName, Request $request): array
    {
        try {
            $settings = DB::table('email_settings')->where('id', 1)->first();

            if (! $settings) {
                $result = ['ok' => false, 'message' => 'Email settings have not been configured.'];
            } else {
                $html = view('emails.field-account-created', [
                    'fullName'     => $user->full_name,
                    'username'     => $user->username,
                    'email'        => $user->email,
                    'tempPassword' => $plainPassword,
                    'officeName'   => $officeName,
                    'position'     => $user->position_title,
                    'loginUrl'     => rtrim(config('app.url'), '/') . '/login',
                ])->render();

                $result = $this->mailer->send(
                    (array) $settings,
                    $user->email,
                    $user->full_name,
                    'Your DENR RDAC account has been created',
                    $html
                );
            }
        } catch (\Throwable $e) {
            report($e); // never includes the password
            $result = ['ok' => false, 'message' => 'The email could not be sent.'];
        }

        AuditLog::create([
            'user_id'     => $request->user()->user_id,
            'action'      => $result['ok'] ? 'account_email_sent' : 'account_email_failed',
            'entity_type' => 'users',
            'entity_id'   => $user->user_id,
            'new_values'  => ['to' => $user->email],
            'ip_address'  => $request->ip(),
            'user_agent'  => substr((string) $request->userAgent(), 0, 255),
        ]);

        return $result;
    }
}