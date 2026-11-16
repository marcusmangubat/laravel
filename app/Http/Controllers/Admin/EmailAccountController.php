<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmailAccount;
use Illuminate\Http\Request;
use App\Services\EmailSettingsService;
use App\Services\EmailSettingsCrypto;
use Illuminate\Support\Facades\DB;

class EmailAccountController extends Controller
{
    public function store(Request $request, EmailSettingsCrypto $crypto)
    {
        $d = $request->validate([
            'label'       => 'nullable|string|max:100',
            'email'       => 'required|email|max:150|unique:email_accounts,email',
            'smtp_pass'   => 'required|string|max:100',
            'daily_limit' => 'required|integer|min:1|max:2000',
        ]);

        $a = EmailAccount::create([
            'label'       => $d['label'] ?? '',
            'email'       => $d['email'],
            'smtp_pass'   => $crypto->encrypt(str_replace(' ', '', $d['smtp_pass'])),
            'daily_limit' => $d['daily_limit'],
            'priority'    => (int) EmailAccount::max('priority') + 1,
        ]);

        $this->audit('email_account_added', $a);
        return back()->with('success', 'Gmail account added to the queue.');
    }

        public function test(Request $request, EmailAccount $account, EmailSettingsService $mailer)
    {
        $d = $request->validate(['test_email' => 'required|email|max:150']);

        $settings = (array) DB::table('email_settings')->where('id', 1)->first();

        $r = $mailer->sendWithAccount(
            $account,
            $settings,
            $d['test_email'],
            'System Administrator',
            'Test Email Connection',
            '<p>Hello,</p><p>This is a test email from the <strong>DENR RDAC Complaint Management System</strong>.</p><p>If you received this message, this Gmail account is working.</p>'
        );

        if ($r['ok']) {
            $this->audit('email_account_test_sent', $account);
        }

        return response()->json($r, $r['ok'] ? 200 : 422);
    }

    public function toggle(EmailAccount $account)
    {
        $account->update(['is_active' => ! $account->is_active]);
        $this->audit($account->is_active ? 'email_account_enabled' : 'email_account_disabled', $account);
        return back()->with('success', 'Account updated.');
    }

    public function move(Request $request, EmailAccount $account)
    {
        $up = $request->input('direction') === 'up';

        $neighbor = EmailAccount::query()
            ->when($up,
                fn ($q) => $q->where('priority', '<', $account->priority)->orderByDesc('priority'),
                fn ($q) => $q->where('priority', '>', $account->priority)->orderBy('priority'))
            ->first();

        if ($neighbor) {
            DB::transaction(function () use ($account, $neighbor) {
                [$a, $b] = [$account->priority, $neighbor->priority];
                $account->update(['priority' => $b]);
                $neighbor->update(['priority' => $a]);
            });
        }
        return back();
    }

    public function reset(EmailAccount $account)
    {
        $account->update(['sent_today' => 0, 'exhausted_until' => null, 'last_error' => null]);
        $this->audit('email_account_reset', $account);
        return back()->with('success', 'Account counter reset.');
    }

    public function destroy(EmailAccount $account)
    {
        $this->audit('email_account_deleted', $account);
        $account->delete();
        return back()->with('success', 'Account removed.');
    }

    private function audit(string $action, EmailAccount $a): void
    {
        DB::table('audit_logs')->insert([
            'user_id'     => auth()->id(),
            'action'      => $action,
            'entity_type' => 'email_accounts',
            'entity_id'   => $a->account_id,
            'new_values'  => json_encode(['email' => $a->email]),
            'ip_address'  => request()->ip(),
            'user_agent'  => mb_substr((string) request()->userAgent(), 0, 255),
        ]);
    }
    public function update(Request $request, EmailAccount $account)
    {
        $d = $request->validate([
            'label'       => 'nullable|string|max:100',
            'daily_limit' => 'required|integer|min:1|max:2000',
        ]);

        $account->update([
            'label'       => $d['label'] ?? '',
            'daily_limit' => $d['daily_limit'],
        ]);

        $this->audit('email_account_updated', $account);
        return back()->with('success', 'Account updated.');
    }
}