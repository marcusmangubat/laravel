<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ComplaintAdminNotifier
{
    private const EVENTS = [
        'recorded'       => 'New complaint recorded by a field office',
        'acknowledged'   => 'Assignment acknowledged',
        'status_changed' => 'Complaint status changed',
        'update_added'   => 'Investigation update added',
        'info_submitted' => 'Additional information submitted',
        'edited'         => 'Complaint details edited',
        'deleted'        => 'Complaint deleted',
    ];

    private const FIELD_LABELS = [
        'title' => 'Title', 'category_id' => 'Category', 'priority' => 'Priority',
        'description' => 'Description', 'received_channel' => 'Channel',
        'received_at' => 'Date received', 'incident_datetime' => 'Date of incident',
        'target_date' => 'Target response date', 'province_id' => 'Province',
        'municipality' => 'Municipality', 'barangay' => 'Barangay',
        'specific_location' => 'Specific location', 'is_anonymous' => 'Anonymous',
        'complainant_name' => 'Complainant name', 'complainant_contact' => 'Complainant contact',
        'complainant_email' => 'Complainant email',
    ];

    public function __construct(private EmailSettingsService $mailer)
    {
    }

    /** Old/new values that differ, for the "edited" email. */
    public static function diff(array $old, array $new): array
    {
        $out = [];
        foreach ($new as $k => $v) {
            $o = $old[$k] ?? null;
            if ((string) $o !== (string) $v) {
                $out[$k] = ['from' => $o, 'to' => $v];
            }
        }
        return $out;
    }

    /**
     * Never throws: a mail problem must not break the field office's action.
     *
     * $extra keys (all optional): from_status, reason, details, photo_count,
     * changes (from diff()), reference_no + title (needed only for 'deleted').
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

            $c = $c ? (array) $c : [
                'complaint_id' => $complaintId,
                'reference_no' => $extra['reference_no'] ?? "#{$complaintId}",
                'title'        => $extra['title'] ?? '',
            ];

            if ($event === 'update_added' && ($c['status_code'] ?? '') === 'for_info') {
                $event = 'info_submitted';
            }

            $actor = DB::table('users as u')
                ->leftJoin('offices as o', 'o.office_id', '=', 'u.office_id')
                ->where('u.user_id', $actorId)
                ->first(['u.full_name', 'u.username', 'u.position_title', 'o.office_name']);

            $overdue = ! empty($c['target_date'])
                && $c['target_date'] < now()->toDateString()
                && ! in_array((int) ($c['status_id'] ?? 0), [8, 9], true);

            $changes = [];
            foreach (($extra['changes'] ?? []) as $k => $v) {
                $changes[self::FIELD_LABELS[$k] ?? $k] = [
                    'from' => $this->pretty($k, $v['from']),
                    'to'   => $this->pretty($k, $v['to']),
                ];
            }

            $label   = self::EVENTS[$event] ?? $event;
            $subject = "{$label}: " . ($c['reference_no'] ?? ''); // EmailSettingsService adds the prefix

            $html = view('emails.complaint-activity', [
                'label'    => $label,
                'event'    => $event,
                'c'        => $c,
                'actor'    => $actor,
                'overdue'  => $overdue,
                'extra'    => $extra,
                'changes'  => $changes,
                'when'     => now()->format('M j, Y g:i A'),
                'link'     => rtrim(config('app.url'), '/') . "/admin/complaints/{$complaintId}",
            ])->render();

            $sent = 0;
            $failed = 0;
            foreach ($this->recipients($settings) as [$email, $name]) {
                $r = $this->mailer->send($settings, $email, $name, $subject, $html);
                ($r['ok'] ?? false) ? $sent++ : $failed++;
            }

            DB::table('audit_logs')->insert([
                'user_id'     => $actorId,
                'action'      => 'admin_email_notified',
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

    /** @return array<int, array{0:string,1:string}> */
    private function recipients(array $settings): array
    {
        $list = [];

        DB::table('users')->where('role', 'admin')->where('is_active', 1)
            ->whereNotNull('email')->get(['email', 'full_name'])
            ->each(function ($u) use (&$list) {
                $list[strtolower(trim($u->email))] = [trim($u->email), $u->full_name ?: 'RDAC Administrator'];
            });

        foreach (['admin_email', 'alert_recipient'] as $k) {
            $e = trim((string) ($settings[$k] ?? ''));
            if ($e !== '') {
                $list[strtolower($e)] ??= [$e, 'RDAC Administrator'];
            }
        }

        return array_values(array_filter($list, fn ($r) => filter_var($r[0], FILTER_VALIDATE_EMAIL)));
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