<?php

namespace App\Services;

use App\Models\EmailAccount;
use PHPMailer\PHPMailer\PHPMailer;
use Throwable;

class EmailSettingsService
{
    public function __construct(private EmailSettingsCrypto $crypto)
    {
    }

    /**
     * Sends through the Gmail queue (email_accounts) in priority order.
     * On a limit or auth error, the next account is tried automatically.
     * Falls back to the SMTP settings in email_settings as a last resort.
     *
     * @return array{ok: bool, message: string}
     */
    public function send(array $settings, string $recipient, string $recipientName, string $subject, string $html): array
    {
        if (! filter_var(trim($recipient), FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'message' => 'The recipient email address is not valid.'];
        }

        $triedEmails = [];
        $last = null;

        foreach (EmailAccount::available()->get() as $acct) {
            $triedEmails[] = strtolower($acct->email);

            $accountSettings = array_merge($settings, [
                'driver'          => 'smtp',
                'from_email'      => $acct->email,
                'smtp_host'       => $acct->smtp_host,
                'smtp_port'       => $acct->smtp_port,
                'smtp_encryption' => $acct->smtp_encryption,
                'smtp_user'       => $acct->email,
                'smtp_pass'       => $acct->smtp_pass, // already encrypted with EmailSettingsCrypto
            ]);

            $r = $this->attempt($accountSettings, $recipient, $recipientName, $subject, $html);

            if ($r['ok']) {
                $acct->recordSent(1);
                return ['ok' => true, 'message' => 'Email sent using ' . $acct->email . '.'];
            }

            switch ($r['kind']) {
                case 'limit':
                    $acct->markExhausted($r['detail']);
                    $last = $r;
                    continue 2; // next account
                case 'auth':
                    $acct->markFailed($r['detail'], 60);
                    $last = $r;
                    continue 2;
                case 'connect':
                    $acct->forceFill(['last_error' => mb_substr($r['detail'], 0, 500)])->save();
                    $last = $r;
                    continue 2;
                default:
                    // Bad recipient, rejected content, etc. Do not burn through the queue.
                    $acct->forceFill(['last_error' => mb_substr($r['detail'], 0, 500)])->save();
                    return ['ok' => false, 'message' => $r['message']];
            }
        }

        // Last resort: the SMTP account saved in email_settings (skip if it was already tried above).
        $legacyUser = strtolower(trim((string) ($settings['smtp_user'] ?? '')));
        if (! in_array($legacyUser, $triedEmails, true)) {
            $r = $this->attempt($settings, $recipient, $recipientName, $subject, $html);
            return ['ok' => $r['ok'], 'message' => $r['message']];
        }

        return [
            'ok' => false,
            'message' => $last['message'] ?? 'All Gmail accounts in the queue are unavailable. Add another account or try again later.',
        ];
    }

        /**
     * Send through ONE specific queue account (no failover). Used for per-account tests.
     *
     * @return array{ok: bool, message: string}
     */
    public function sendWithAccount(EmailAccount $acct, array $settings, string $recipient, string $recipientName, string $subject, string $html): array
    {
        if (! filter_var(trim($recipient), FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'message' => 'The recipient email address is not valid.'];
        }

        $accountSettings = array_merge($settings, [
            'driver'          => 'smtp',
            'from_email'      => $acct->email,
            'smtp_host'       => $acct->smtp_host,
            'smtp_port'       => $acct->smtp_port,
            'smtp_encryption' => $acct->smtp_encryption,
            'smtp_user'       => $acct->email,
            'smtp_pass'       => $acct->smtp_pass,
        ]);

        $r = $this->attempt($accountSettings, $recipient, $recipientName, $subject, $html);

        if ($r['ok']) {
            $acct->recordSent(1);
            return ['ok' => true, 'message' => 'Test email sent using ' . $acct->email . '.'];
        }

        if ($r['kind'] === 'limit') {
            $acct->markExhausted($r['detail']);
        } elseif ($r['kind'] === 'auth') {
            $acct->markFailed($r['detail'], 60);
        } else {
            $acct->forceFill(['last_error' => mb_substr($r['detail'], 0, 500)])->save();
        }

        return ['ok' => false, 'message' => $acct->email . ': ' . $r['message']];
    }

    /**
     * Single send attempt with one set of SMTP settings.
     *
     * @return array{ok: bool, message: string, kind: string, detail: string}
     */
    private function attempt(array $settings, string $recipient, string $recipientName, string $subject, string $html): array
    {
        $fail = fn (string $message, string $kind = 'config', string $detail = '') => [
            'ok' => false, 'message' => $message, 'kind' => $kind, 'detail' => $detail ?: $message,
        ];

        $driver = ($settings['driver'] ?? 'smtp') === 'mail' ? 'mail' : 'smtp';
        $from = trim((string) ($settings['from_email'] ?? ''));
        $fromName = trim((string) ($settings['from_name'] ?? '')) ?: 'DENR RDAC CMS';
        $host = trim((string) ($settings['smtp_host'] ?? ''));
        $port = (int) ($settings['smtp_port'] ?? 465);
        $encryption = (string) ($settings['smtp_encryption'] ?? 'ssl');
        $smtpUser = trim((string) ($settings['smtp_user'] ?? ''));
        $smtpPass = $this->crypto->decrypt($settings['smtp_pass'] ?? null);

        if (! filter_var($from, FILTER_VALIDATE_EMAIL)) {
            if (filter_var($smtpUser, FILTER_VALIDATE_EMAIL)) {
                $from = $smtpUser;
            } else {
                return $fail('Set a valid From email address in Email Settings.');
            }
        }

        if ($driver === 'smtp') {
            if ($host === '' || $port < 1 || $port > 65535) {
                return $fail('SMTP host and port are required.');
            }
            if ($smtpUser === '' || $smtpPass === '') {
                return $fail('SMTP username and password are required. Save them in Email Settings, then try again.');
            }
            if (str_contains(strtolower($host), 'gmail.com') && ! str_contains($smtpUser, '@')) {
                return $fail('For Gmail, use the full Gmail address as the SMTP username.');
            }
            if ($encryption === 'ssl' && $port === 587) {
                $encryption = 'tls';
            } elseif ($encryption === 'tls' && $port === 465) {
                $encryption = 'ssl';
            }
        }

        $mail = new PHPMailer(true);

        try {
            $mail->CharSet = PHPMailer::CHARSET_UTF8;
            $mail->Encoding = PHPMailer::ENCODING_BASE64;
            $mail->Timeout = 20;
            $mail->SMTPDebug = 0;

            if ($driver === 'smtp') {
                $mail->isSMTP();
                $mail->Host = $host;
                $mail->Port = $port;
                $mail->SMTPAuth = true;
                $mail->Username = $smtpUser;
                $mail->Password = str_contains(strtolower($host), 'gmail.com')
                    ? str_replace(' ', '', $smtpPass)
                    : $smtpPass;
                $mail->SMTPAutoTLS = $encryption !== 'none';

                if ($encryption === 'ssl') {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                } elseif ($encryption === 'tls') {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                } else {
                    $mail->SMTPSecure = '';
                    $mail->SMTPAutoTLS = false;
                }
            } else {
                $mail->isMail();
            }

            $mail->setFrom($from, $fromName);
            $mail->Sender = $from;

            $adminEmail = trim((string) ($settings['admin_email'] ?? ''));
            if ($adminEmail !== '' && filter_var($adminEmail, FILTER_VALIDATE_EMAIL) && strcasecmp($adminEmail, $from) !== 0) {
                $mail->addReplyTo($adminEmail);
            }

            $mail->addAddress(trim($recipient), $recipientName);
            $prefix = trim((string) ($settings['subject_prefix'] ?? ''));
            $mail->Subject = ($prefix !== '' ? $prefix . ' ' : '') . $subject;
            $mail->isHTML(true);
            $mail->Body = $html;
            $mail->AltBody = trim(html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8'));
            $mail->send();

            return ['ok' => true, 'message' => 'Email sent.', 'kind' => 'ok', 'detail' => ''];
        } catch (Throwable $e) {
            $raw = trim((string) $mail->ErrorInfo) ?: $e->getMessage();
            report($e);
            $lower = strtolower($raw);

            // Gmail sending limit / quota (e.g. "550 5.4.5 Daily user sending limit exceeded")
            if (preg_match('/(5\.4\.5|4\.5\.3|4\.7\.0|4\.2\.1|daily user sending|sending limit|quota|rate limit|too many (messages|recipients))/i', $raw)) {
                return $fail('This Gmail account reached its sending limit.', 'limit', $raw);
            }

            if (str_contains($lower, 'authenticate') || str_contains($lower, '535') || str_contains($lower, 'username and password not accepted')) {
                $hint = str_contains(strtolower($host), 'gmail.com')
                    ? ' For Gmail, use the full Gmail address and a Google App Password.'
                    : ' Check the SMTP username and password.';
                return $fail('SMTP authentication failed.' . $hint, 'auth', $raw);
            }

            if (str_contains($lower, 'could not connect') || str_contains($lower, 'connection refused') || str_contains($lower, 'timed out') || str_contains($lower, 'failed to connect')) {
                return $fail('Could not connect to the SMTP server. Check the host, port, and encryption.', 'connect', $raw);
            }

            return $fail('The email could not be sent. Check the mail configuration and application log.', 'other', $raw);
        }
    }
}