<?php

namespace App\Services;

use PHPMailer\PHPMailer\PHPMailer;
use Throwable;

class EmailSettingsService
{
    public function __construct(private EmailSettingsCrypto $crypto)
    {
    }

    /**
     * @return array{ok: bool, message: string}
     */
    public function send(array $settings, string $recipient, string $recipientName, string $subject, string $html): array
    {
        if (! filter_var(trim($recipient), FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'message' => 'The recipient email address is not valid.'];
        }

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
                return ['ok' => false, 'message' => 'Set a valid From email address in Email Settings.'];
            }
        }

        if ($driver === 'smtp') {
            if ($host === '' || $port < 1 || $port > 65535) {
                return ['ok' => false, 'message' => 'SMTP host and port are required.'];
            }
            if ($smtpUser === '' || $smtpPass === '') {
                return ['ok' => false, 'message' => 'SMTP username and password are required. Save them in Email Settings, then try again.'];
            }
            if (str_contains(strtolower($host), 'gmail.com') && ! str_contains($smtpUser, '@')) {
                return ['ok' => false, 'message' => 'For Gmail, use the full Gmail address as the SMTP username.'];
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
                $mail->Username = str_contains($smtpUser, '@') ? $smtpUser : $smtpUser;
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

                // Keep TLS certificate verification enabled.
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

            return ['ok' => true, 'message' => 'Email sent.'];
        } catch (Throwable $e) {
            $raw = trim((string) $mail->ErrorInfo) ?: $e->getMessage();
            report($e);

            $lower = strtolower($raw);
            if (str_contains($lower, 'authenticate') || str_contains($lower, '535') || str_contains($lower, 'username and password not accepted')) {
                $hint = str_contains(strtolower($host), 'gmail.com')
                    ? ' For Gmail, use the full Gmail address and a Google App Password.'
                    : ' Check the SMTP username and password.';
                return ['ok' => false, 'message' => 'SMTP authentication failed.' . $hint];
            }

            if (str_contains($lower, 'could not connect') || str_contains($lower, 'connection refused') || str_contains($lower, 'timed out') || str_contains($lower, 'failed to connect')) {
                return ['ok' => false, 'message' => 'Could not connect to the SMTP server. Check the host, port, and encryption.'];
            }

            return ['ok' => false, 'message' => 'The email could not be sent. Check the mail configuration and application log.'];
        }
    }
}
