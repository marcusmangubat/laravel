<?php

// app/Services/WorkflowMail.php
// Port of admin/includes/workflow_mail.php.
//
// Same behavior as before:
//  - the person who acted is never emailed
//  - failures are logged and never block the action
//  - complainant details are included for staff only; complainants are not emailed
//  - emails go out AFTER the response is sent (dispatch()->afterResponse() replaces wfm_flush()
//    + fastcgi_finish_request()), so no queue worker is needed.
//    If you prefer a real queue, swap the dispatch() block in queueFor() for Mail::queue().

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class WorkflowMail
{
    public function officeName(int $officeId): string
    {
        return DB::table('offices')->where('office_id', $officeId)->value('office_name') ?? 'The assigned office';
    }

    public function notifyAdmins(int $complaintId, int $actorId, string $heading, string $intro, array $details = []): void
    {
        try {
            $rows = DB::table('users')
                ->where('role', 'admin')->where('is_active', 1)->where('user_id', '<>', $actorId)
                ->get(['email', 'full_name'])->map(fn ($r) => (array) $r)->all();

            // Extra recipients that were in the mail settings table (admin_email, alert_recipient)
            $actorEmail = strtolower(trim((string) DB::table('users')->where('user_id', $actorId)->value('email')));
            foreach ((array) config('complaints.extra_admin_emails', []) as $extra) {
                $extra = trim((string) $extra);
                if ($extra !== '' && strtolower($extra) !== $actorEmail) {
                    $rows[] = ['email' => $extra, 'full_name' => 'RDAC Administrator'];
                }
            }
            $this->queueFor($rows, $complaintId, $heading, $intro, $details);
        } catch (Throwable $e) {
            Log::error('notifyAdmins mail: ' . $e->getMessage());
        }
    }

    public function notifyOffice(int $officeId, int $complaintId, int $actorId, string $heading, string $intro, array $details = []): void
    {
        if ($officeId <= 0) {
            return;
        }
        try {
            $rows = DB::table('users')
                ->where('role', 'field_office')->where('office_id', $officeId)
                ->where('is_active', 1)->where('user_id', '<>', $actorId)
                ->get(['email', 'full_name'])->map(fn ($r) => (array) $r)->all();
            $this->queueFor($rows, $complaintId, $heading, $intro, $details);
        } catch (Throwable $e) {
            Log::error('notifyOffice mail: ' . $e->getMessage());
        }
    }

    // ───────── Internals ─────────

    /** Skips malformed addresses and placeholder domains such as example.com or *.test. */
    private function usableEmail(string $email): bool
    {
        $email = trim($email);
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return false;
        }
        return ! preg_match('/@(example\.(com|org|net)|.+\.(test|invalid|example|localhost))$/i', $email);
    }

    private function queueFor(array $recipients, int $complaintId, string $heading, string $intro, array $details): void
    {
        $seen = [];
        $targets = [];
        foreach ($recipients as $r) {
            $email = trim((string) ($r['email'] ?? ''));
            $key = strtolower($email);
            if (isset($seen[$key]) || ! $this->usableEmail($email)) {
                continue;
            }
            $seen[$key] = true;
            $targets[] = [$email, (string) ($r['full_name'] ?? '')];
        }
        if (! $targets) {
            return;
        }

        $c = $this->loadComplaint($complaintId);
        if (! $c) {
            return;
        }
        $m = $this->build($c, $heading, $intro, $details);

        dispatch(function () use ($targets, $m) {
            foreach ($targets as [$email, $name]) {
                try {
                    Mail::html($m['html'], function ($msg) use ($email, $name, $m) {
                        $msg->to($email, $name !== '' ? $name : null)->subject($m['subject'])->text($m['alt']);
                    });
                } catch (Throwable $e) {
                    Log::error("Workflow email not sent to {$email}: " . $e->getMessage());
                }
            }
        })->afterResponse();
    }

    private function loadComplaint(int $complaintId): ?array
    {
        $row = DB::table('complaints as c')
            ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
            ->leftJoin('complaint_categories as cc', 'cc.category_id', '=', 'c.category_id')
            ->leftJoin('provinces as p', 'p.province_id', '=', 'c.province_id')
            ->leftJoin('offices as o', 'o.office_id', '=', 'c.current_office_id')
            ->leftJoin('users as rec', 'rec.user_id', '=', 'c.recorded_by')
            ->where('c.complaint_id', $complaintId)
            ->first([
                'c.reference_no', 'c.title', 'c.description', 'c.received_channel', 'c.received_at',
                'c.incident_datetime', 'c.municipality', 'c.barangay', 'c.specific_location', 'c.priority',
                'c.target_date', 'c.resolution_summary', 'c.resolved_at', 'c.closed_at',
                'c.complainant_name', 'c.complainant_contact', 'c.complainant_email', 'c.is_anonymous',
                's.status_name', 'cc.category_name', 'p.province_name', 'o.office_name as current_office',
                'rec.full_name as recorder_name',
            ]);
        return $row ? (array) $row : null;
    }

    private function dt(?string $s): string
    {
        return $s ? Carbon::parse($s)->format('M j, Y g:i A') : '';
    }

    private function d(?string $s): string
    {
        return $s ? Carbon::parse($s)->format('M j, Y') : '';
    }

    private function rows(array $c, array $eventDetails): array
    {
        $location = implode(', ', array_filter([
            $c['specific_location'] ?? '',
            ! empty($c['barangay']) ? 'Brgy. ' . $c['barangay'] : '',
            $c['municipality'] ?? '',
            $c['province_name'] ?? '',
        ]));
        $channel = ComplaintWorkflow::CHANNELS[$c['received_channel'] ?? ''] ?? ($c['received_channel'] ?? '');

        $rows = [
            'Reference no.' => $c['reference_no'] ?? '',
            'Subject' => $c['title'] ?? '',
            'Current status' => $c['status_name'] ?? '',
            'Priority' => ucfirst((string) ($c['priority'] ?? '')),
            'Category' => $c['category_name'] ?? 'Uncategorized',
            'Responsible office' => $c['current_office'] ?? 'Not yet assigned',
            'Received through' => $channel,
            'Date received' => $this->dt($c['received_at'] ?? null),
            'Date of incident' => ! empty($c['incident_datetime']) ? $this->dt($c['incident_datetime']) : 'Unknown',
            'Location' => $location !== '' ? $location : 'Unknown',
            'Target date' => $this->d($c['target_date'] ?? null),
            'Recorded by' => $c['recorder_name'] ?? '',
            'Description' => $c['description'] ?? '',
        ];

        if (! empty($c['is_anonymous'])) {
            $rows['Complainant'] = 'Anonymous';
        } else {
            $rows['Complainant name'] = $c['complainant_name'] ?? '';
            $rows['Complainant contact'] = $c['complainant_contact'] ?? '';
            $rows['Complainant email'] = $c['complainant_email'] ?? '';
        }
        if (! empty($c['resolution_summary'])) {
            $rows['Resolution summary'] = $c['resolution_summary'];
        }
        if (! empty($c['resolved_at'])) {
            $rows['Resolved at'] = $this->dt($c['resolved_at']);
        }
        if (! empty($c['closed_at'])) {
            $rows['Closed at'] = $this->dt($c['closed_at']);
        }

        foreach ($eventDetails as $label => $value) {
            if ($value !== null && trim((string) $value) !== '') {
                $rows[$label] = $value;
            }
        }
        return $rows;
    }

    private function build(array $c, string $heading, string $intro, array $details): array
    {
        $rows = $this->rows($c, $details);
        $esc = static fn ($v, int $max = 8000): string => e(mb_substr(trim((string) $v), 0, $max));

        $html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;max-width:640px">'
            . '<h2 style="margin:0 0 12px;font-size:18px;color:#166534">' . $esc($heading, 200) . '</h2>'
            . '<p style="margin:0 0 16px;line-height:1.5">' . $esc($intro, 1000) . '</p>'
            . '<table style="border-collapse:collapse;width:100%">';
        $text = $heading . "\n\n" . $intro . "\n\n";

        foreach ($rows as $label => $value) {
            if (trim((string) $value) === '') {
                continue;
            }
            $html .= '<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb;width:170px;vertical-align:top"><strong>'
                . $esc($label, 80) . '</strong></td><td style="padding:6px 10px;border:1px solid #e5e7eb;white-space:pre-wrap">'
                . nl2br($esc($value)) . '</td></tr>';
            $text .= $label . ': ' . mb_substr(trim((string) $value), 0, 8000) . "\n";
        }
        $html .= '</table><p style="margin:16px 0 0;color:#6b7280;font-size:12px">Automated message from the DENR RDAC Complaint Management System. '
            . 'Log in to view the full record, history, and photos.</p></div>';
        $text .= "\nAutomated message from the DENR RDAC Complaint Management System.";

        return [
            'subject' => 'Complaint ' . ($c['reference_no'] ?? '') . ': ' . $heading,
            'html' => $html,
            'alt' => $text,
        ];
    }
}