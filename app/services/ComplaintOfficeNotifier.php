<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ComplaintOfficeNotifier
{
    private const LABELS = [
        'status_changed' => 'Complaint status changed',
        'update_added'   => 'RDAC added an update to the complaint',
        'edited'         => 'Complaint details were edited by RDAC',
        'deleted'        => 'Complaint was deleted by RDAC',
    ];

    public function __construct(private EmailSettingsService $mailer)
    {
    }

    /**
     * Never throws: a mail problem must not break the admin's action.
     *
     * $extra (all optional): assigned_office_id, assignment_type, target_date, reason,
     * previous_office_id, from_status, details, photo_count, changes (from
     * ComplaintAdminNotifier::diff()), reference_no + title (for 'deleted').
     */
    public function notify(int $complaintId, string $event, int $actorId, array $extra = [], ?string $ip = null): void
    {
        try {
            $settings = DB::table('email_settings')->where('id', 1)->first();
            if (! $settings) {
                return;
            }
            $settings = (array) $settings;

            $c = DB::table('complaints as c')
                ->leftJoin('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->leftJoin('complaint_categories as cat', 'cat.category_id', '=', 'c.category_id')
                ->leftJoin('provinces as p', 'p.province_id', '=', 'c.province_id')
                ->leftJoin('offices as o', 'o.office_id', '=', 'c.current_office_id')
                ->where('c.complaint_id', $complaintId)
                ->select('c.*', 's.status_name', 's.status_code', 'cat.category_name', 'p.province_name', 'o.office_name')
                ->first();
            if (! $c) {
                return;
            }
            $c = (array) $c;

            $actor = DB::table('users')->where('user_id', $actorId)->first(['full_name', 'position_title']);

            // Which offices are involved, and in what role
            $roles = [];
            if (! empty($c['current_office_id'])) {
                $roles[(int) $c['current_office_id']] = 'primary';
            }
            DB::table('complaint_assignments')
                ->where('complaint_id', $complaintId)
                ->where('assignment_type', 'secondary')->where('is_current', 1)
                ->pluck('to_office_id')
                ->each(function ($o) use (&$roles) {
                    $roles[(int) $o] ??= 'coordinating';
                });

            $previous = (int) ($extra['previous_office_id'] ?? 0);

            if ($event === 'assigned') {
                // Only the newly assigned office and the office that lost the case
                $targets = array_filter([(int) ($extra['assigned_office_id'] ?? 0), $previous]);
                $roles = array_intersect_key($roles, array_flip($targets));
                if ($previous && ! isset($roles[$previous])) {
                    $roles[$previous] = 'removed';
                }
            }
            if (! $roles) {
                return;
            }

            $overdue = ! empty($c['target_date'])
                && $c['target_date'] < now()->toDateString()
                && ! in_array((int) $c['status_id'], [8, 9], true);

            $changes = [];
            foreach (($extra['changes'] ?? []) as $k => $v) {
                $changes[$k] = ['from' => $this->pretty($k, $v['from']), 'to' => $this->pretty($k, $v['to'])];
            }

            $assignedOffice = ! empty($extra['assigned_office_id'])
                ? DB::table('offices')->where('office_id', $extra['assigned_office_id'])->value('office_name') : null;
            $previousOffice = $previous
                ? DB::table('offices')->where('office_id', $previous)->value('office_name') : null;

            // Recipients: active users of each office, plus the office's own email address
            $recipients = [];   // email => [name, role]
            foreach ($roles as $officeId => $role) {
                DB::table('users')->where('role', 'field_office')->where('is_active', 1)
                    ->where('office_id', $officeId)->whereNotNull('email')
                    ->get(['email', 'full_name'])
                    ->each(function ($u) use (&$recipients, $role) {
                        $recipients[strtolower(trim($u->email))] ??= [trim($u->email), $u->full_name, $role];
                    });

                $officeEmail = trim((string) DB::table('offices')->where('office_id', $officeId)->value('email'));
                if ($officeEmail !== '') {
                    $recipients[strtolower($officeEmail)] ??= [$officeEmail, 'Field Office', $role];
                }
            }

            $sent = 0;
            $failed = 0;
            foreach ($recipients as [$email, $name, $role]) {
                $label = $this->label($event, $role);
                $html = view('emails.complaint-office-activity', [
                    'label'          => $label,
                    'event'          => $event,
                    'role'           => $role,
                    'c'              => $c,
                    'actor'          => $actor,
                    'overdue'        => $overdue,
                    'extra'          => $extra,
                    'changes'        => $changes,
                    'assignedOffice' => $assignedOffice,
                    'previousOffice' => $previousOffice,
                    'recipientName'  => $name,
                    'when'           => now()->format('M j, Y g:i A'),
                    'link'           => rtrim(config('app.url'), '/') . "/field/complaints/{$complaintId}",
                ])->render();

                // EmailSettingsService adds the subject prefix itself
                $r = $this->mailer->send($settings, $email, $name, $label . ': ' . $c['reference_no'], $html);
                ($r['ok'] ?? false) ? $sent++ : $failed++;
            }

            DB::table('audit_logs')->insert([
                'user_id'     => $actorId,
                'action'      => 'office_email_notified',
                'entity_type' => 'complaints',
                'entity_id'   => $complaintId,
                'new_values'  => json_encode(['event' => $event, 'sent' => $sent, 'failed' => $failed]),
                'ip_address'  => $ip,
                'user_agent'  => null,
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function label(string $event, string $role): string
    {
        if ($event === 'assigned') {
            return match ($role) {
                'primary'      => 'Complaint assigned to your office',
                'coordinating' => 'Your office was added as a coordinating office',
                default        => 'Complaint reassigned to another office',
            };
        }
        return self::LABELS[$event] ?? $event;
    }

    private function pretty(string $key, $v): string
    {
        if ($v === null || $v === '') {
            return '—';
        }
        return (string) match ($key) {
            'category_id'  => DB::table('complaint_categories')->where('category_id', $v)->value('category_name') ?? $v,
            'province_id'  => DB::table('provinces')->where('province_id', $v)->value('province_name') ?? $v,
            'is_anonymous' => $v ? 'Yes' : 'No',
            default        => $v,
        };
    }
}