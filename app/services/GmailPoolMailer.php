<?php

namespace App\Services;

use App\Models\EmailAccount;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

class GmailPoolMailer
{
    public function send($to, string $subject, string $html): array
    {
        $s          = DB::table('email_settings')->where('id', 1)->first();
        $prefix     = trim($s->subject_prefix ?? '');
        $fromName   = $s->from_name ?? 'DENR RDAC Complaint Management System';
        $replyTo    = $s->from_email ?? null;
        $subject    = $prefix !== '' ? "$prefix $subject" : $subject;
        $recipients = is_array($to) ? $to : [$to];

        $accounts = EmailAccount::available()->get();
        if ($accounts->isEmpty()) {
            throw new RuntimeException('No Gmail account is available (all disabled or at their sending limit).');
        }

        $tried = [];

        foreach ($accounts as $account) {
            try {
                $mailer = Mail::build([
                    'transport'  => 'smtp',
                    'host'       => $account->smtp_host,
                    'port'       => $account->smtp_port,
                    'encryption' => $account->smtp_encryption,
                    'username'   => $account->email,
                    'password'   => Crypt::decryptString($account->smtp_pass),
                    'timeout'    => 20,
                ]);

                $mailer->html($html, function ($m) use ($recipients, $subject, $account, $fromName, $replyTo) {
                    $m->to($recipients)->subject($subject)->from($account->email, $fromName);
                    if ($replyTo) {
                        $m->replyTo($replyTo);
                    }
                });

                $account->recordSent(count($recipients));

                return ['ok' => true, 'account' => $account->email, 'tried' => $tried];
            } catch (Throwable $e) {
                $msg = $e->getMessage();

                if (self::isLimitError($msg)) {
                    $account->markExhausted($msg);
                    $tried[] = $account->email . ' (limit reached)';
                    Log::warning("Gmail limit hit for {$account->email}, switching account.");
                    continue;
                }
                if (self::isAuthError($msg)) {
                    $account->markFailed($msg, 60);
                    $tried[] = $account->email . ' (auth failed)';
                    Log::warning("Gmail auth failed for {$account->email}, switching account.");
                    continue;
                }

                $account->forceFill(['last_error' => mb_substr($msg, 0, 500)])->save();
                throw $e;
            }
        }

        throw new RuntimeException('All Gmail accounts failed: ' . implode(', ', $tried));
    }

    public static function isLimitError(string $m): bool
    {
        return (bool) preg_match(
            '/(5\.4\.5|4\.5\.3|4\.7\.0|4\.2\.1|daily user sending|sending limit|quota|rate limit|too many (messages|recipients))/i', $m);
    }

    public static function isAuthError(string $m): bool
    {
        return (bool) preg_match('/(535|5\.7\.8|username and password not accepted|authenticat)/i', $m);
    }
}