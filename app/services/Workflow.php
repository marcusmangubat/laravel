<?php

// app/Services/Workflow.php
//
// Port of includes/workflow.php (+ the data loaders from complaint_render.php) for the field-office
// complaint page: view data, acknowledge, change status, investigation updates, edit, soft delete,
// and photo access. NOT ported yet: wf_record_complaint and wf_assign (the list-page create and the
// admin assign flow). Say the word and I'll port them the same way.
//
// Every action returns ['ok' => bool, 'message' => string, 'code' => int, 'errors' => array].

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class Workflow
{
    private const PHOTO_EXT = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    public function __construct(private WorkflowMailer $mail) {}

    // ───────── helpers ─────────

    private function fail(int $code, string $message, array $errors = []): array
    {
        return ['ok' => false, 'code' => $code, 'message' => $message, 'errors' => $errors];
    }

    /** Roll back the open transaction (if any) and return a failure. */
    private function deny(int $code, string $message, array $errors = []): array
    {
        if (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        return $this->fail($code, $message, $errors);
    }

    private function lockComplaint(int $id, array $cols)
    {
        return DB::table('complaints')->where('complaint_id', $id)->lockForUpdate()->first($cols);
    }

    /** Mail and audit problems must never undo a saved action. */
    private function safely(callable $fn): void
    {
        try {
            $fn();
        } catch (Throwable $e) {
            Log::error('workflow side effect failed: ' . $e->getMessage());
        }
    }

    private function audit(int $userId, string $action, int $complaintId, array $data): void
    {
        // TODO: replace with your audit logger (write_audit in the PHP version).
        Log::info('audit', compact('userId', 'action', 'complaintId', 'data'));
    }

    private function notifyOffice(int $officeId, int $complaintId, string $type, string $message, int $excludeUserId = 0): void
    {
        $this->safely(fn () => DB::insert(
            "INSERT INTO notifications (user_id, complaint_id, notif_type, message)
             SELECT user_id, ?, ?, ? FROM users
             WHERE office_id = ? AND role = 'field_office' AND is_active = 1 AND user_id <> ?",
            [$complaintId, $type, mb_substr($message, 0, 300), $officeId, $excludeUserId]
        ));
    }

    private function notifyAdmins(int $complaintId, string $type, string $message, int $excludeUserId = 0): void
    {
        $this->safely(fn () => DB::insert(
            "INSERT INTO notifications (user_id, complaint_id, notif_type, message)
             SELECT user_id, ?, ?, ? FROM users
             WHERE role = 'admin' AND is_active = 1 AND user_id <> ?",
            [$complaintId, $type, mb_substr($message, 0, 300), $excludeUserId]
        ));
    }

    // ───────── permissions / transitions ─────────

    /** Allowed next statuses for a role. 'assigned' is excluded: it is reached only by assigning an office. */
    public function allowedTransitions(int $fromStatusId, string $role): array
    {
        return DB::table('status_transitions as t')
            ->join('complaint_statuses as s', 's.status_id', '=', 't.to_status_id')
            ->where('t.from_status_id', $fromStatusId)
            ->where('t.allowed_role', $role)
            ->where('s.status_code', '<>', 'assigned')
            ->orderBy('s.sort_order')
            ->get(['t.to_status_id as id', 's.status_code as code', 's.status_name as name', 't.requires_reason'])
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'code' => $r->code,
                'name' => $r->name,
                'requires_reason' => (bool) $r->requires_reason,
            ])->all();
    }

    /** Edit/delete of the original record: only the person in recorded_by, and only at early statuses. */
    public function ownerPermissions(int $recordedBy, int $userId, string $statusCode): array
    {
        $owner = $recordedBy > 0 && $recordedBy === $userId;
        $canEdit = $owner && in_array($statusCode, ['recorded', 'for_review'], true);
        $canDelete = $owner && $statusCode === 'recorded';
        $reason = '';

        if ($owner && !$canEdit) {
            $reason = match ($statusCode) {
                'for_assignment', 'assigned' => 'This complaint has entered assignment, so the original record can no longer be edited or deleted.',
                'under_investigation' => 'The original complaint cannot be changed while it is under investigation. Add an investigation update instead.',
                'for_info' => 'The original complaint cannot be changed. Submit additional information using the update form.',
                default => 'This complaint can no longer be edited or deleted.',
            };
        } elseif ($owner && $canEdit && !$canDelete) {
            $reason = 'This complaint is under initial review, so it can be edited but not deleted.';
        } elseif (!$owner) {
            $reason = 'Only the person who recorded this complaint can edit or delete the original record.';
        }

        return ['can_edit' => $canEdit, 'can_delete' => $canDelete, 'is_owner' => $owner, 'restrict_reason' => $reason];
    }

    private function canAcknowledge(int $complaintId, string $role, ?int $officeId): bool
    {
        if ($role !== 'field_office' || !$officeId) {
            return false;
        }
        return DB::table('complaint_assignments')
            ->where('complaint_id', $complaintId)->where('to_office_id', $officeId)
            ->where('is_current', 1)->whereNull('acknowledged_at')->exists();
    }

    private function canPostUpdate(string $statusCode, string $role, ?int $officeId, int $complaintId): bool
    {
        if (!in_array($statusCode, ['under_investigation', 'for_info'], true)) {
            return false;
        }
        if ($role === 'admin') {
            return true;
        }
        if ($role !== 'field_office' || !$officeId) {
            return false;
        }
        return DB::table('complaint_assignments')
            ->where('complaint_id', $complaintId)->where('to_office_id', $officeId)
            ->where('is_current', 1)->exists();
    }

    // ───────── view data (structured, no HTML) ─────────

    /** $c is the complaint row the controller already loaded (with status_code). */
    public function viewPayload(object $c, string $role, ?int $officeId, int $userId): array
    {
        $id = (int) $c->complaint_id;
        $perm = $this->ownerPermissions((int) $c->recorded_by, $userId, $c->status_code);

        return [
            'transitions' => $this->allowedTransitions((int) $c->status_id, $role),
            'can_acknowledge' => $this->canAcknowledge($id, $role, $officeId),
            'can_post_update' => $this->canPostUpdate($c->status_code, $role, $officeId, $id),
            'photos_required' => $c->status_code === 'under_investigation',
            'history' => $this->loadHistory($id),
            'assignments' => $this->loadAssignments($id),
            'actions' => $this->loadActions($id),
        ] + $perm;
    }

    private function loadHistory(int $id): array
    {
        return DB::table('complaint_status_history as h')
            ->leftJoin('complaint_statuses as fs', 'fs.status_id', '=', 'h.from_status_id')
            ->join('complaint_statuses as ts', 'ts.status_id', '=', 'h.to_status_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'h.changed_by')
            ->where('h.complaint_id', $id)
            ->orderByDesc('h.created_at')->orderByDesc('h.history_id')
            ->get(['h.created_at', 'h.reason', 'fs.status_name as from_name', 'ts.status_name as to_name', 'u.full_name'])
            ->all();
    }

    private function loadAssignments(int $id): array
    {
        return DB::table('complaint_assignments as a')
            ->join('offices as o', 'o.office_id', '=', 'a.to_office_id')
            ->leftJoin('offices as fo', 'fo.office_id', '=', 'a.from_office_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'a.assigned_by')
            ->where('a.complaint_id', $id)
            ->orderByDesc('a.created_at')->orderByDesc('a.assignment_id')
            ->get([
                'a.assignment_type', 'a.is_current', 'a.reason', 'a.target_date', 'a.created_at', 'a.acknowledged_at',
                'fo.office_name as from_name', 'o.office_name as to_name', 'u.full_name as by_name',
            ])
            ->map(fn ($r) => (array) $r + [])
            ->map(function ($r) {
                $r['is_current'] = (bool) $r['is_current'];
                return $r;
            })->all();
    }

    private function loadActions(int $id): array
    {
        $rows = DB::table('complaint_actions as ca')
            ->leftJoin('users as u', 'u.user_id', '=', 'ca.user_id')
            ->leftJoin('offices as o', 'o.office_id', '=', 'ca.office_id')
            ->where('ca.complaint_id', $id)
            ->orderByDesc('ca.action_date')->orderByDesc('ca.action_id')
            ->get(['ca.action_id', 'ca.action_type', 'ca.details', 'ca.action_date', 'u.full_name', 'o.office_name']);

        $docs = DB::table('complaint_documents')
            ->where('complaint_id', $id)->where('is_deleted', 0)->where('document_type', 'photo')
            ->orderBy('document_id')
            ->get(['document_id', 'action_id', 'original_name'])
            ->groupBy('action_id');

        return $rows->map(fn ($r) => [
            'action_id' => (int) $r->action_id,
            'action_type' => $r->action_type,
            'details' => $r->details,
            'action_date' => $r->action_date,
            'full_name' => $r->full_name,
            'office_name' => $r->office_name,
            'photos' => ($docs[$r->action_id] ?? collect())
                ->map(fn ($d) => ['document_id' => (int) $d->document_id, 'original_name' => $d->original_name])
                ->values()->all(),
        ])->all();
    }

    // ───────── actions ─────────

    public function acknowledge(int $complaintId, int $userId, int $officeId): array
    {
        try {
            DB::beginTransaction();
            $c = $this->lockComplaint($complaintId, ['complaint_id', 'reference_no', 'deleted_at']);
            if (!$c || $c->deleted_at !== null) {
                return $this->deny(404, 'This complaint does not exist.');
            }

            $a = DB::table('complaint_assignments')
                ->where('complaint_id', $complaintId)->where('to_office_id', $officeId)
                ->where('is_current', 1)->whereNull('acknowledged_at')
                ->orderByDesc('assignment_id')->lockForUpdate()->first(['assignment_id']);
            if (!$a) {
                return $this->deny(422, 'There is no unacknowledged assignment for your office on this complaint.');
            }

            DB::table('complaint_assignments')->where('assignment_id', $a->assignment_id)
                ->update(['acknowledged_at' => now(), 'acknowledged_by' => $userId]);
            DB::commit();
        } catch (Throwable $e) {
            if (DB::transactionLevel() > 0) DB::rollBack();
            Log::error('acknowledge: ' . $e->getMessage());
            return $this->fail(500, 'The assignment could not be acknowledged. Please try again.');
        }

        $this->notifyAdmins($complaintId, 'assigned', "Complaint {$c->reference_no} was acknowledged by the assigned office.", $userId);
        $this->safely(fn () => $this->mail->notifyAdmins(
            $complaintId, $userId, 'Assignment acknowledged',
            $this->mail->officeName($officeId) . ' acknowledged this assignment and has taken responsibility for the case.',
            ['Acknowledged at' => now()->format('M j, Y g:i A')]
        ));
        $this->safely(fn () => $this->audit($userId, 'complaint_acknowledged', $complaintId, [
            'office_id' => $officeId, 'assignment_id' => (int) $a->assignment_id,
        ]));

        return ['ok' => true, 'complaint_id' => $complaintId, 'message' => 'Assignment acknowledged.'];
    }

    /** $officeScope: null for Admin; for a field office, their office id (only the PRIMARY office may change status). */
    public function changeStatus(int $complaintId, int $fromStatusId, int $toStatusId, int $userId, string $role, string $reason, ?int $officeScope = null): array
    {
        $reason = trim($reason);
        if (mb_strlen($reason) > 500) {
            return $this->fail(422, 'Please fix the highlighted fields.', ['reason' => 'Keep the reason within 500 characters.']);
        }

        try {
            DB::beginTransaction();

            // Lock the row so two people cannot change it at the same time
            $c = $this->lockComplaint($complaintId, ['complaint_id', 'reference_no', 'status_id', 'current_office_id', 'deleted_at']);
            if (!$c || $c->deleted_at !== null) {
                return $this->deny(404, 'This complaint does not exist.');
            }
            if ($officeScope !== null && (int) $c->current_office_id !== $officeScope) {
                return $this->deny(403, 'You are not authorized to update this complaint.');
            }
            if ((int) $c->status_id !== $fromStatusId) {
                return $this->deny(409, 'This complaint was updated by someone else. The page has been refreshed with the latest status.');
            }

            $t = DB::table('status_transitions as t')
                ->join('complaint_statuses as ts', 'ts.status_id', '=', 't.to_status_id')
                ->join('complaint_statuses as fs', 'fs.status_id', '=', 't.from_status_id')
                ->where('t.from_status_id', $fromStatusId)->where('t.to_status_id', $toStatusId)->where('t.allowed_role', $role)
                ->first(['t.requires_reason', 'ts.status_code', 'ts.status_name', 'fs.status_code as from_code']);
            if (!$t || $t->status_code === 'assigned') {
                return $this->deny(422, 'That status change is not allowed. Use "Assign office" to assign a complaint.');
            }
            if ($t->requires_reason && $reason === '') {
                return $this->deny(422, 'Please fix the highlighted fields.', ['reason' => 'A reason is required for this status change.']);
            }

            $code = $t->status_code;
            $why = $reason !== '' ? $reason : null;
            $set = ['status_id' => $toStatusId];
            if ($code === 'resolved') {
                $set['resolved_at'] = now();
                $set['resolution_summary'] = $why ?? 'Resolved';
            }
            if ($code === 'closed') {
                $set['closed_at'] = now();
            }
            if ($t->from_code === 'resolved' && $code === 'under_investigation') {
                $set['resolved_at'] = null;
                $set['resolution_summary'] = null;
            }
            if ($code === 'for_assignment') {
                $set['current_office_id'] = null; // returned to RDAC for reassignment
            }
            DB::table('complaints')->where('complaint_id', $complaintId)->update($set);

            if ($code === 'for_assignment') {
                DB::table('complaint_assignments')->where('complaint_id', $complaintId)->where('is_current', 1)
                    ->update(['is_current' => 0, 'ended_at' => now()]);
            }

            DB::table('complaint_status_history')->insert([
                'complaint_id' => $complaintId, 'from_status_id' => $fromStatusId, 'to_status_id' => $toStatusId,
                'changed_by' => $userId, 'reason' => $why,
            ]);

            DB::commit();
        } catch (Throwable $e) {
            if (DB::transactionLevel() > 0) DB::rollBack();
            Log::error('changeStatus: ' . $e->getMessage());
            return $this->fail(500, 'The status could not be updated. Please try again.');
        }

        $msg = "Complaint {$c->reference_no} is now \"{$t->status_name}\".";
        $curOffice = $c->current_office_id !== null ? (int) $c->current_office_id : null;

        if ($code === 'for_assignment' && $curOffice !== null) {
            $this->notifyOffice($curOffice, $complaintId, 'reassigned', "Complaint {$c->reference_no} was returned to RDAC for reassignment.", $userId);
            $this->notifyAdmins($complaintId, 'reassigned', $msg, $userId);
        } elseif ($curOffice !== null) {
            $type = ['for_info' => 'info_requested', 'resolved' => 'resolved', 'closed' => 'closed'][$code] ?? 'status_changed';
            $this->notifyOffice($curOffice, $complaintId, $type, $msg, $userId);
            if ($role === 'field_office') {
                $this->notifyAdmins($complaintId, $type, $msg, $userId);
            }
        }

        if ($curOffice !== null) {
            $event = ['Previous status' => $t->from_code, 'New status' => $t->status_name, 'Reason' => $why];
            $this->safely(function () use ($code, $role, $t, $curOffice, $complaintId, $userId, $event, $why) {
                if ($code === 'for_assignment') {
                    $this->mail->notifyOffice($curOffice, $complaintId, $userId, 'Complaint returned to RDAC',
                        'RDAC returned this complaint for reassignment. Your office no longer owns this case, so please stop work on it.',
                        ['Reason' => $why, 'Previous status' => $t->from_code, 'New status' => $t->status_name]);
                } elseif ($role === 'field_office') {
                    $this->mail->notifyAdmins($complaintId, $userId, 'Status changed by a field office',
                        $this->mail->officeName($curOffice) . " changed the status to \"{$t->status_name}\".", $event);
                } else {
                    [$heading, $intro] = $this->statusMailText($code, $t->from_code, $t->status_name);
                    $this->mail->notifyOffice($curOffice, $complaintId, $userId, $heading, $intro, $event);
                }
            });
        }
        $this->safely(fn () => $this->audit($userId, 'complaint_status_changed', $complaintId, [
            'from' => $fromStatusId, 'to' => $toStatusId, 'reason' => $why,
        ]));

        return ['ok' => true, 'complaint_id' => $complaintId, 'message' => "Status changed to \"{$t->status_name}\"."];
    }

    private function statusMailText(string $code, string $fromCode, string $name): array
    {
        return match (true) {
            $code === 'for_info' => ['Additional information requested', 'RDAC needs additional information on this complaint. Please read the reason below and respond.'],
            $code === 'under_investigation' && $fromCode === 'resolved' => ['Complaint reopened', 'RDAC reopened this complaint. It is back under investigation, so please continue your work.'],
            $code === 'under_investigation' => ['Complaint is under investigation', 'RDAC moved this complaint to Under Investigation. Please continue your work on it.'],
            $code === 'resolved' => ['Complaint marked as resolved', 'RDAC marked this complaint as Resolved.'],
            $code === 'closed' => ['Complaint closed', 'RDAC formally closed this complaint.'],
            $code === 'for_rdac_review' => ['Complaint sent for RDAC review', 'RDAC moved this complaint to For RDAC Review.'],
            default => ['Complaint status updated', "RDAC changed the status of this complaint to \"$name\"."],
        };
    }

    /** @param UploadedFile[] $photos already validated (type/size/count) by the controller */
    public function postInvestigationUpdate(int $complaintId, int $userId, string $role, ?int $officeId, string $details, array $photos): array
    {
        $details = trim($details);
        if ($details === '') {
            return $this->fail(422, 'Please fix the highlighted fields.', ['details' => 'Describe the investigation update.']);
        }
        if (mb_strlen($details) > 4000) {
            return $this->fail(422, 'Please fix the highlighted fields.', ['details' => 'Keep the update within 4,000 characters.']);
        }

        $saved = [];
        try {
            DB::beginTransaction();

            $c = DB::table('complaints as c')
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->where('c.complaint_id', $complaintId)->lockForUpdate()
                ->first(['c.complaint_id', 'c.reference_no', 'c.current_office_id', 'c.deleted_at', 's.status_code']);
            if (!$c || $c->deleted_at !== null) {
                return $this->deny(404, 'This complaint does not exist.');
            }
            if (!in_array($c->status_code, ['under_investigation', 'for_info'], true)) {
                return $this->deny(422, 'Updates can be added only while the complaint is under investigation or awaiting additional information.');
            }
            if ($c->status_code === 'under_investigation' && $photos === []) {
                return $this->deny(422, 'Please fix the highlighted fields.', ['photos' => 'Attach at least one photo of the investigation.']);
            }
            if ($role === 'field_office') {
                $assigned = $officeId && DB::table('complaint_assignments')
                    ->where('complaint_id', $complaintId)->where('to_office_id', $officeId)->where('is_current', 1)->exists();
                if (!$assigned) {
                    return $this->deny(403, 'You are not authorized to update this complaint.');
                }
            } elseif ($role !== 'admin') {
                return $this->deny(403, 'You are not authorized to update this complaint.');
            }

            $actionId = DB::table('complaint_actions')->insertGetId([
                'complaint_id' => $complaintId, 'office_id' => $officeId ?: null, 'user_id' => $userId,
                'action_type' => 'investigation_update', 'details' => $details,
                'action_date' => now(), 'is_internal' => 1,
            ]);

            $disk = Storage::disk('local'); // private: storage/app/private (never web-accessible)
            foreach ($photos as $p) {
                $mime = $p->getMimeType() ?: '';
                $stored = bin2hex(random_bytes(16)) . '.' . (self::PHOTO_EXT[$mime] ?? 'jpg');
                $rel = "complaints/$complaintId/$stored";
                $hash = hash_file('sha256', $p->getRealPath()) ?: '';
                $size = (int) $p->getSize();
                $name = mb_substr(basename($p->getClientOriginalName()), 0, 255);

                $disk->putFileAs("complaints/$complaintId", $p, $stored);
                $saved[] = $rel;

                DB::table('complaint_documents')->insert([
                    'complaint_id' => $complaintId, 'action_id' => $actionId, 'uploaded_by' => $userId,
                    'document_type' => 'photo', 'original_name' => $name !== '' ? $name : $stored,
                    'stored_name' => $stored, 'file_path' => $rel, 'mime_type' => $mime,
                    'file_size' => $size, 'sha256' => $hash,
                ]);
            }

            DB::table('complaints')->where('complaint_id', $complaintId)->update(['updated_at' => now()]);
            DB::commit();
        } catch (Throwable $e) {
            if (DB::transactionLevel() > 0) DB::rollBack();
            foreach ($saved as $path) {
                Storage::disk('local')->delete($path);
            }
            Log::error('postInvestigationUpdate: ' . $e->getMessage());
            return $this->fail(500, 'The update could not be saved. Please try again.');
        }

        $n = count($photos);
        $photoText = "$n photo" . ($n === 1 ? '' : 's');
        $lead = $c->status_code === 'for_info' ? 'Additional information' : 'An investigation update';
        $msg = $lead . ($n > 0 ? " with $photoText" : '') . " was added to complaint {$c->reference_no}.";
        $curOffice = $c->current_office_id !== null ? (int) $c->current_office_id : null;

        if ($role === 'field_office') {
            $this->notifyAdmins($complaintId, 'update_added', $msg, $userId);
        }
        if ($curOffice !== null) {
            $this->notifyOffice($curOffice, $complaintId, 'update_added', $msg, $userId);
        }

        $bits = ['Photos attached' => (string) $n, 'Update' => $details];
        $this->safely(function () use ($role, $officeId, $curOffice, $complaintId, $userId, $photoText, $bits) {
            if ($role === 'field_office') {
                $this->mail->notifyAdmins($complaintId, $userId, 'Investigation update with photos',
                    $this->mail->officeName((int) $officeId) . " added an investigation update with $photoText.", $bits);
            } elseif ($curOffice !== null) {
                $this->mail->notifyOffice($curOffice, $complaintId, $userId, 'Investigation update from RDAC',
                    "RDAC added an investigation update with $photoText.", $bits);
            }
        });
        $this->safely(fn () => $this->audit($userId, 'complaint_update_added', $complaintId, [
            'action_id' => $actionId, 'photo_count' => $n,
        ]));

        $savedMsg = $c->status_code === 'for_info'
            ? 'Additional information saved' . ($n > 0 ? " with $photoText" : '') . '.'
            : "Investigation update saved with $photoText.";
        return ['ok' => true, 'complaint_id' => $complaintId, 'message' => $savedMsg];
    }

    /** $f uses the form field names. is_outside_region is intentionally left unchanged (the edit form has no such field). */
    public function updateComplaint(int $complaintId, int $userId, array $f): array
    {
        $cols = [
            'title', 'category_id', 'description', 'received_channel', 'received_at', 'incident_datetime',
            'province_id', 'municipality', 'barangay', 'specific_location', 'complainant_name',
            'complainant_contact', 'complainant_email', 'is_anonymous', 'priority', 'target_date',
        ];

        try {
            DB::beginTransaction();
            $c = DB::table('complaints as c')
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->where('c.complaint_id', $complaintId)->lockForUpdate()
                ->first(['c.*', 's.status_code']);
            if (!$c || $c->deleted_at !== null) {
                return $this->deny(404, 'This complaint does not exist.');
            }
            $perm = $this->ownerPermissions((int) $c->recorded_by, $userId, $c->status_code);
            if (!$perm['can_edit']) {
                return $this->deny(403, $perm['restrict_reason'] ?: 'You cannot edit this complaint.');
            }

            $new = [];
            foreach ($cols as $col) {
                $new[$col] = $f[$col] ?? null;
            }
            $new['is_anonymous'] = !empty($f['is_anonymous']) ? 1 : 0;
            DB::table('complaints')->where('complaint_id', $complaintId)->update($new);
            DB::commit();
        } catch (Throwable $e) {
            if (DB::transactionLevel() > 0) DB::rollBack();
            Log::error('updateComplaint: ' . $e->getMessage());
            return $this->fail(500, 'The complaint could not be updated. Please try again.');
        }

        $changes = [];
        foreach ($new as $col => $val) {
            if ((string) ($c->$col ?? '') !== (string) ($val ?? '')) {
                $changes[$col] = ['from' => $c->$col ?? null, 'to' => $val];
            }
        }
        $this->safely(fn () => $this->audit($userId, 'complaint_edited', $complaintId, [
            'reference_no' => $c->reference_no, 'status' => $c->status_code, 'changes' => $changes,
        ]));

        return ['ok' => true, 'complaint_id' => $complaintId, 'message' => "Complaint {$c->reference_no} was updated."];
    }

    public function softDeleteComplaint(int $complaintId, int $userId): array
    {
        try {
            DB::beginTransaction();
            $c = DB::table('complaints as c')
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->where('c.complaint_id', $complaintId)->lockForUpdate()
                ->first(['c.complaint_id', 'c.reference_no', 'c.recorded_by', 'c.deleted_at', 's.status_code']);
            if (!$c || $c->deleted_at !== null) {
                return $this->deny(404, 'This complaint does not exist.');
            }
            $perm = $this->ownerPermissions((int) $c->recorded_by, $userId, $c->status_code);
            if (!$perm['can_delete']) {
                return $this->deny(403, $perm['restrict_reason'] ?: 'You cannot delete this complaint.');
            }
            DB::table('complaints')->where('complaint_id', $complaintId)
                ->update(['deleted_at' => now(), 'deleted_by' => $userId]);
            DB::commit();
        } catch (Throwable $e) {
            if (DB::transactionLevel() > 0) DB::rollBack();
            Log::error('softDeleteComplaint: ' . $e->getMessage());
            return $this->fail(500, 'The complaint could not be deleted. Please try again.');
        }

        $this->safely(fn () => $this->audit($userId, 'complaint_deleted', $complaintId, [
            'reference_no' => $c->reference_no, 'status' => $c->status_code, 'soft_delete' => true,
        ]));
        return ['ok' => true, 'complaint_id' => $complaintId, 'message' => "Complaint {$c->reference_no} was deleted."];
    }

    // ───────── photo access ─────────

    /** Returns the document row if this viewer may see it and the file exists, else null. */
    public function documentForViewer(int $documentId, string $role, ?int $officeId): ?object
    {
        $row = DB::table('complaint_documents')->where('document_id', $documentId)
            ->first(['document_id', 'complaint_id', 'file_path', 'mime_type', 'original_name', 'is_deleted']);
        if (!$row || (int) $row->is_deleted === 1) {
            return null;
        }

        if ($role === 'field_office') {
            $ok = DB::selectOne(
                "SELECT 1 AS ok FROM complaints c
                 WHERE c.complaint_id = ? AND c.deleted_at IS NULL AND (c.current_office_id = ? OR EXISTS (
                     SELECT 1 FROM complaint_assignments ax
                     WHERE ax.complaint_id = c.complaint_id AND ax.to_office_id = ? AND ax.is_current = 1))",
                [(int) $row->complaint_id, (int) $officeId, (int) $officeId]
            );
            if (!$ok) {
                return null;
            }
        } elseif ($role !== 'admin') {
            return null;
        }

        return Storage::disk('local')->exists($row->file_path) ? $row : null;
    }
}