<?php
//App/Http/Controllers/Admin/EmailSettingsController.php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\EmailSettingsCrypto;
use App\Services\EmailSettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class EmailSettingsController extends Controller
{
    private function defaults(): array
    {
        return [
            'id' => 1,
            'admin_email' => '',
            'from_email' => '',
            'from_name' => 'DENR RDAC Complaint Management System',
            'subject_prefix' => '[DENR RDAC]',
            'alert_recipient' => '',
            'cooldown_hours' => 12,
            'driver' => 'smtp',
            'smtp_host' => '',
            'smtp_port' => 465,
            'smtp_encryption' => 'ssl',
            'smtp_user' => '',
            'smtp_pass' => '',
        ];
    }

    private function ensureRow(): void
    {
        DB::table('email_settings')->insertOrIgnore([
            'id' => 1,
            'admin_email' => '',
            'from_email' => '',
            'from_name' => 'DENR RDAC Complaint Management System',
            'subject_prefix' => '[DENR RDAC]',
            'alert_recipient' => '',
            'cooldown_hours' => 12,
            'driver' => 'smtp',
            'smtp_host' => '',
            'smtp_port' => 465,
            'smtp_encryption' => 'ssl',
            'smtp_user' => '',
            'smtp_pass' => '',
        ]);
    }

    public function index()
    {
        abort_unless(auth()->user()?->role === 'admin' && auth()->user()?->is_active, 403);

        $this->ensureRow();
        $settings = (array) DB::table('email_settings')->where('id', 1)->first();

        // Never send the encrypted or decrypted SMTP password to the browser.
        unset($settings['smtp_pass']);
        $settings['has_smtp_password'] = DB::table('email_settings')
            ->where('id', 1)
            ->whereNotNull('smtp_pass')
            ->where('smtp_pass', '<>', '')
            ->exists();

        return Inertia::render('admin/email-settings', [
            'settings' => array_merge($this->defaults(), $settings),
        ]);
    }

    public function update(Request $request, EmailSettingsCrypto $crypto)
    {
        abort_unless(auth()->user()?->role === 'admin' && auth()->user()?->is_active, 403);

        $this->ensureRow();
        $existing = (array) DB::table('email_settings')->where('id', 1)->first();

        $validated = $request->validate([
            'admin_email' => ['nullable', 'email', 'max:150'],
            'from_email' => ['required', 'email', 'max:150'],
            'from_name' => ['nullable', 'string', 'max:150'],
            'subject_prefix' => ['nullable', 'string', 'max:100'],
            'alert_recipient' => ['nullable', 'email', 'max:150'],
            'cooldown_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'driver' => ['required', Rule::in(['smtp', 'mail'])],
            'smtp_host' => ['nullable', 'string', 'max:255'],
            'smtp_port' => ['required', 'integer', 'min:1', 'max:65535'],
            'smtp_encryption' => ['required', Rule::in(['ssl', 'tls', 'none'])],
            'smtp_user' => ['nullable', 'string', 'max:150'],
            'smtp_pass' => ['nullable', 'string', 'max:500'],
        ]);

        $validated['admin_email'] = trim((string) ($validated['admin_email'] ?? ''));
        $validated['alert_recipient'] = trim((string) ($validated['alert_recipient'] ?? ''));
        $validated['from_email'] = trim($validated['from_email']);
        $validated['from_name'] = trim((string) ($validated['from_name'] ?? '')) ?: 'DENR RDAC Complaint Management System';
        $validated['subject_prefix'] = trim((string) ($validated['subject_prefix'] ?? ''));
        $validated['smtp_host'] = trim((string) ($validated['smtp_host'] ?? ''));
        $validated['smtp_user'] = trim((string) ($validated['smtp_user'] ?? ''));

        if ($validated['driver'] === 'smtp') {
            $request->validate([
                'smtp_host' => ['required', 'string', 'max:255'],
                'smtp_user' => ['required', 'string', 'max:150'],
            ]);

            if (str_contains(strtolower($validated['smtp_host']), 'gmail.com')
                && ! str_contains($validated['smtp_user'], '@')) {
                return back()->withErrors([
                    'smtp_user' => 'For Gmail, use the full address (example@gmail.com), not a short username.',
                ])->withInput();
            }

            if (empty($existing['smtp_pass']) && trim((string) $request->input('smtp_pass', '')) === '') {
                return back()->withErrors(['smtp_pass' => 'Enter the SMTP password.'])->withInput();
            }

            if ($validated['smtp_encryption'] === 'ssl' && (int) $validated['smtp_port'] === 587) {
                $validated['smtp_encryption'] = 'tls';
            } elseif ($validated['smtp_encryption'] === 'tls' && (int) $validated['smtp_port'] === 465) {
                $validated['smtp_encryption'] = 'ssl';
            }
        }

        $newPassword = trim((string) $request->input('smtp_pass', ''));
        $validated['smtp_pass'] = $newPassword !== ''
            ? $crypto->encrypt($newPassword)
            : (string) ($existing['smtp_pass'] ?? '');

        $oldAuditValues = [
            'driver' => $existing['driver'] ?? null,
            'smtp_host' => $existing['smtp_host'] ?? null,
            'smtp_user' => $existing['smtp_user'] ?? null,
            'from_email' => $existing['from_email'] ?? null,
        ];
        $newAuditValues = [
            'driver' => $validated['driver'],
            'smtp_host' => $validated['smtp_host'],
            'smtp_user' => $validated['smtp_user'],
            'from_email' => $validated['from_email'],
        ];

        $validated['updated_by'] = auth()->id();
        $validated['updated_at'] = now();

        DB::transaction(function () use ($validated, $oldAuditValues, $newAuditValues, $request) {
            DB::table('email_settings')->updateOrInsert(['id' => 1], $validated);

            DB::table('audit_logs')->insert([
                'user_id' => auth()->id(),
                'action' => 'update_email_settings',
                'entity_type' => 'email_settings',
                'entity_id' => 1,
                'old_values' => json_encode($oldAuditValues),
                'new_values' => json_encode($newAuditValues),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'created_at' => now(),
            ]);
        });

        return redirect()->route('admin.email-settings')->with('success', 'Email settings saved.');
    }

    public function sendTestEmail(Request $request, EmailSettingsService $mailer)
    {
        abort_unless(auth()->user()?->role === 'admin' && auth()->user()?->is_active, 403);

        $validated = $request->validate([
            'test_email' => ['required', 'email', 'max:150'],
        ]);

        $settings = (array) DB::table('email_settings')->where('id', 1)->first();
        if (! $settings) {
            return response()->json(['ok' => false, 'message' => 'Email settings have not been saved yet.'], 422);
        }

        $result = $mailer->send(
            $settings,
            $validated['test_email'],
            'System Administrator',
            'Test Email Connection',
            '<p>Hello,</p><p>This is a test email from the <strong>DENR RDAC Complaint Management System</strong>.</p><p>If you received this message, your email configuration is working.</p>'
        );

        if ($result['ok']) {
            DB::table('audit_logs')->insert([
                'user_id' => auth()->id(),
                'action' => 'test_email_sent',
                'entity_type' => 'email_settings',
                'entity_id' => 1,
                'old_values' => null,
                'new_values' => json_encode(['recipient' => $validated['test_email']]),
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'created_at' => now(),
            ]);

            return response()->json([
                'ok' => true,
                'message' => 'Test email successfully sent to ' . $validated['test_email'] . '.',
            ]);
        }

        return response()->json($result, 422);
    }
}
