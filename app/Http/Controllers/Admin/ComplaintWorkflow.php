<?php

// app/Services/ComplaintWorkflow.php
// Port of includes/workflow.php (business rules) + the cr_load_* queries from complaint_render.php.
//
// Error convention: field problems throw ValidationException keyed by field name (Inertia puts
// them in form.errors). General problems use the key "form", which the React page shows in the
// banner. A missing complaint aborts with 404.

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use App\Http\Requests\Admin\StoreComplaintRequest;
use RuntimeException;
use Throwable;

class ComplaintWorkflow
{
    /** Statuses in which Admin may assign or reassign an office. */
    public const ASSIGNABLE = ['for_assignment', 'assigned', 'under_investigation', 'for_info', 'for_rdac_review'];

    public const CHANNELS = [
        'phone' => 'Phone call', 'email' => 'Email', 'letter' => 'Letter', 'walk_in' => 'Walk-in',
        'referral' => 'Referral', 'social_media' => 'Social media', 'other' => 'Other',
    ];

    public const PHOTO_MAX_BYTES = 5242880; // 5 MB
    public const PHOTO_MAX_COUNT = 8;
    public const PHOTO_MIMES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    public function __construct(private WorkflowMail $mail)
    {
    }

    private function fail(string $message, array $errors = []): never
    {
        throw ValidationException::withMessages($errors ?: ['form' => $message]);
    }

    // ───────── Reads ─────────

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
                'id' => (int) $r->id, 'code' => $r->code, 'name' => $r->name,
                'requires_reason' => (bool) $r->requires_reason,
            ])->all();
    }

    /** Edit/delete of the original record is only for the person in recorded_by, and only at early statuses. */
    public function ownerPermissions(int $recordedBy, int $userId, string $statusCode): array
    {
        $owner = $recordedBy > 0 && $recordedBy === $userId;
        $canEdit = $owner && in_array($statusCode, ['recorded', 'for_review'], true);
        $canDelete = $owner && $statusCode === 'recorded';
        $reason = '';
        if ($owner && ! $canEdit) {
            $reason = match ($statusCode) {
                'for_assignment', 'assigned' => 'This complaint has entered assignment, so the original record can no longer be edited or deleted.',
                'under_investigation' => 'The original complaint cannot be changed while it is under investigation. Add an investigation update instead.',
                'for_info' => 'The original complaint cannot be changed. Submit additional information using the update form.',
                default => 'This complaint can no longer be edited or deleted.',
            };
        } elseif ($owner && $canEdit && ! $canDelete) {
            $reason = 'This complaint is under initial review, so it can be edited but not deleted.';
        } elseif (! $owner) {
            $reason = 'Only the person who recorded this complaint can edit or delete the original record.';
        }
        return ['can_edit' => $canEdit, 'can_delete' => $canDelete, 'is_owner' => $owner, 'restrict_reason' => $reason];
    }

    public function canPostUpdate(string $statusCode, string $role, ?int $officeId, int $complaintId): bool
    {
        if (! in_array($statusCode, ['under_investigation', 'for_info'], true)) {
            return false;
        }
        if ($role === 'admin') {
            return true;
        }
        if ($role !== 'field_office' || ! $officeId) {
            return false;
        }
        return DB::table('complaint_assignments')
            ->where('complaint_id', $complaintId)->where('to_office_id', $officeId)->where('is_current', 1)->exists();
    }

    public function history(int $id): array
    {
        return DB::table('complaint_status_history as h')
            ->leftJoin('complaint_statuses as fs', 'fs.status_id', '=', 'h.from_status_id')
            ->join('complaint_statuses as ts', 'ts.status_id', '=', 'h.to_status_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'h.changed_by')
            ->where('h.complaint_id', $id)
            ->orderByDesc('h.created_at')->orderByDesc('h.history_id')
            ->get(['h.history_id as id', 'h.created_at', 'h.reason', 'fs.status_name as from_name', 'ts.status_name as to_name', 'u.full_name'])
            ->all();
    }

    public function assignments(int $id): array
    {
        return DB::table('complaint_assignments as a')
            ->join('offices as o', 'o.office_id', '=', 'a.to_office_id')
            ->leftJoin('offices as fo', 'fo.office_id', '=', 'a.from_office_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'a.assigned_by')
            ->where('a.complaint_id', $id)
            ->orderByDesc('a.created_at')->orderByDesc('a.assignment_id')
            ->get([
                'a.assignment_id as id', 'a.assignment_type', 'a.is_current', 'a.reason', 'a.target_date',
                'a.created_at', 'a.acknowledged_at', 'fo.office_name as from_name', 'o.office_name as to_name',
                'u.full_name as by_name',
            ])
            ->map(function ($a) {
                $a->is_current = (bool) $a->is_current;
                return $a;
            })->all();
    }

    public function actions(int $id): array
    {
        $rows = DB::table('complaint_actions as ca')
            ->leftJoin('users as u', 'u.user_id', '=', 'ca.user_id')
            ->leftJoin('offices as o', 'o.office_id', '=', 'ca.office_id')
            ->where('ca.complaint_id', $id)
            ->orderByDesc('ca.action_date')->orderByDesc('ca.action_id')
            ->get(['ca.action_id as id', 'ca.action_type', 'ca.details', 'ca.action_date', 'u.full_name', 'o.office_name'])
            ->keyBy('id');

        foreach ($rows as $r) {
            $r->photos = [];
        }
        if ($rows->isNotEmpty()) {
            $docs = DB::table('complaint_documents')
                ->where('complaint_id', $id)->where('is_deleted', 0)->where('document_type', 'photo')
                ->orderBy('document_id')
                ->get(['document_id', 'action_id', 'original_name']);
            foreach ($docs as $doc) {
                if (isset($rows[$doc->action_id])) {
                    $rows[$doc->action_id]->photos[] = [
                        'document_id' => (int) $doc->document_id,
                        'original_name' => $doc->original_name,
                        'url' => "/admin/documents/{$doc->document_id}",
                    ];
                }
            }
        }
        return $rows->values()->all();
    }

    // ───────── Change status ─────────

    /** $officeScope: null for Admin; a field-office user's office_id (only the PRIMARY office may change status). */
    public function changeStatus(int $complaintId, int $fromStatusId, int $toStatusId, int $userId, string $role, string $reason, ?int $officeScope = null): string
    {
        $reason = trim($reason);
        if (mb_strlen($reason) > 500) {
            $this->fail('', ['reason' => 'Keep the reason within 500 characters.']);
        }

        [$c, $t] = DB::transaction(function () use ($complaintId, $fromStatusId, $toStatusId, $userId, $role, $reason, $officeScope) {
            // Lock the row so two people cannot change it at the same time
            $c = DB::table('complaints')->where('complaint_id', $complaintId)->lockForUpdate()->first();
            if (! $c || $c->deleted_at !== null) {
                abort(404);
            }
            if ($officeScope !== null && (int) $c->current_office_id !== $officeScope) {
                $this->fail('You are not authorized to update this complaint.');
            }
            if ((int) $c->status_id !== $fromStatusId) {
                $this->fail('This complaint was updated by someone else. The page has been refreshed with the latest status.');
            }

            $t = DB::table('status_transitions as t')
                ->join('complaint_statuses as ts', 'ts.status_id', '=', 't.to_status_id')
                ->join('complaint_statuses as fs', 'fs.status_id', '=', 't.from_status_id')
                ->where('t.from_status_id', $fromStatusId)->where('t.to_status_id', $toStatusId)->where('t.allowed_role', $role)
                ->first(['t.requires_reason', 'ts.status_code', 'ts.status_name', 'fs.status_code as from_code']);
            if (! $t || $t->status_code === 'assigned') {
                $this->fail('That status change is not allowed. Use "Assign office" to assign a complaint.');
            }
            if ($t->requires_reason && $reason === '') {
                $this->fail('', ['reason' => 'A reason is required for this status change.']);
            }

            $code = $t->status_code;
            $why = $reason !== '' ? $reason : null;
            $set = ['status_id' => $toStatusId, 'updated_at' => now()];
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
                'changed_by' => $userId, 'reason' => $why, 'created_at' => now(),
            ]);

            return [$c, $t];
        });

        // ---- After commit: in-system notifications, then email ----
        $code = $t->status_code;
        $why = $reason !== '' ? $reason : null;
        $officeId = $c->current_office_id !== null ? (int) $c->current_office_id : null;
        $msg = "Complaint {$c->reference_no} is now \"{$t->status_name}\".";

        if ($code === 'for_assignment' && $officeId !== null) {
            $this->notifyOffice($officeId, $complaintId, 'reassigned', "Complaint {$c->reference_no} was returned to RDAC for reassignment.", $userId);
            $this->notifyAdmins($complaintId, 'reassigned', $msg, $userId);
            $this->mail->notifyOffice($officeId, $complaintId, $userId,
                'Complaint returned to RDAC',
                'RDAC returned this complaint for reassignment. Your office no longer owns this case, so please stop work on it.',
                ['Reason' => $why, 'Previous status' => $t->from_code, 'New status' => $t->status_name]);
        } elseif ($officeId !== null) {
            $type = ['for_info' => 'info_requested', 'resolved' => 'resolved', 'closed' => 'closed'][$code] ?? 'status_changed';
            $this->notifyOffice($officeId, $complaintId, $type, $msg, $userId);
            if ($role === 'field_office') {
                $this->notifyAdmins($complaintId, $type, $msg, $userId);
            }

            $event = ['Previous status' => $t->from_code, 'New status' => $t->status_name, 'Reason' => $why];
            if ($role === 'field_office') {
                $this->mail->notifyAdmins($complaintId, $userId, 'Status changed by a field office',
                    $this->mail->officeName($officeId) . " changed the status to \"{$t->status_name}\".", $event);
            } else {
                [$heading, $intro] = match (true) {
                    $code === 'for_info' => ['Additional information requested', 'RDAC needs additional information on this complaint. Please read the reason below and respond.'],
                    $code === 'under_investigation' && $t->from_code === 'resolved' => ['Complaint reopened', 'RDAC reopened this complaint. It is back under investigation, so please continue your work.'],
                    $code === 'under_investigation' => ['Complaint is under investigation', 'RDAC moved this complaint to Under Investigation. Please continue your work on it.'],
                    $code === 'resolved' => ['Complaint marked as resolved', 'RDAC marked this complaint as Resolved.'],
                    $code === 'closed' => ['Complaint closed', 'RDAC formally closed this complaint.'],
                    $code === 'for_rdac_review' => ['Complaint sent for RDAC review', 'RDAC moved this complaint to For RDAC Review.'],
                    default => ['Complaint status updated', "RDAC changed the status of this complaint to \"{$t->status_name}\"."],
                };
                $this->mail->notifyOffice($officeId, $complaintId, $userId, $heading, $intro, $event);
            }
        }
        $this->audit($userId, 'complaint_status_changed', $complaintId, ['from' => $fromStatusId, 'to' => $toStatusId, 'reason' => $why]);

        return "Status changed to \"{$t->status_name}\".";
    }

    // ───────── Assign office (Admin) ─────────

    public function assign(int $complaintId, int $officeId, string $type, string $reason, string $targetDate, int $adminId): string
    {
        $reason = trim($reason);
        $errors = [];
        if (! in_array($type, ['primary', 'secondary'], true)) {
            $errors['assignment_type'] = 'Choose primary or secondary.';
        }
        if (mb_strlen($reason) > 500) {
            $errors['reason'] = 'Keep the reason within 500 characters.';
        }
        if ($targetDate !== '') {
            $d = \DateTime::createFromFormat('Y-m-d', $targetDate);
            if (! $d || $d->format('Y-m-d') !== $targetDate) {
                $errors['target_date'] = 'Enter a valid target date.';
            }
        }
        $office = $officeId > 0
            ? DB::table('offices')->where('office_id', $officeId)->where('is_active', 1)->where('can_receive_assignments', 1)->first(['office_id', 'office_name'])
            : null;
        if (! $office) {
            $errors['office_id'] = 'Choose an active office that can receive assignments.';
        }
        if ($errors) {
            $this->fail('', $errors);
        }

        [$c, $oldOffice, $target, $why] = DB::transaction(function () use ($complaintId, $officeId, $type, $reason, $targetDate, $adminId, $office) {
            $c = DB::table('complaints as c')
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->where('c.complaint_id', $complaintId)->lockForUpdate()
                ->first(['c.complaint_id', 'c.reference_no', 'c.status_id', 'c.current_office_id', 'c.received_at', 'c.deleted_at', 's.status_code']);
            if (! $c || $c->deleted_at !== null) {
                abort(404);
            }
            if (! in_array($c->status_code, self::ASSIGNABLE, true)) {
                $this->fail(in_array($c->status_code, ['recorded', 'for_review'], true)
                    ? 'Move the complaint to "For Assignment" before assigning an office.'
                    : 'A resolved or closed complaint cannot be assigned.');
            }
            if ($targetDate !== '' && $targetDate < substr((string) $c->received_at, 0, 10)) {
                $this->fail('', ['target_date' => 'The target date cannot be before the received date.']);
            }

            $oldOffice = $c->current_office_id !== null ? (int) $c->current_office_id : null;
            $target = $targetDate !== '' ? $targetDate : null;
            $why = $reason !== '' ? $reason : null;

            if ($type === 'primary') {
                if ($oldOffice === $officeId) {
                    $this->fail('', ['office_id' => 'This office is already the primary office.']);
                }
                if ($oldOffice !== null && $reason === '') {
                    $this->fail('', ['reason' => 'A reason is required when reassigning.']);
                }

                DB::table('complaint_assignments')->where('complaint_id', $complaintId)->where('assignment_type', 'primary')->where('is_current', 1)
                    ->update(['is_current' => 0, 'ended_at' => now()]);
                // If the new primary office was a coordinating office, that role ends
                DB::table('complaint_assignments')->where('complaint_id', $complaintId)->where('assignment_type', 'secondary')
                    ->where('is_current', 1)->where('to_office_id', $officeId)
                    ->update(['is_current' => 0, 'ended_at' => now()]);

                DB::table('complaint_assignments')->insert([
                    'complaint_id' => $complaintId, 'assignment_type' => 'primary', 'from_office_id' => $oldOffice,
                    'to_office_id' => $officeId, 'assigned_by' => $adminId, 'reason' => $why,
                    'target_date' => $target, 'is_current' => 1, 'created_at' => now(),
                ]);
                $set = ['current_office_id' => $officeId, 'updated_at' => now()];
                if ($target !== null) {
                    $set['target_date'] = $target;
                }
                DB::table('complaints')->where('complaint_id', $complaintId)->update($set);

                // First assignment moves the complaint from "For Assignment" to "Assigned"
                if ($c->status_code === 'for_assignment') {
                    $a = DB::table('complaint_statuses')->where('status_code', 'assigned')->first(['status_id']);
                    DB::table('complaints')->where('complaint_id', $complaintId)->update(['status_id' => $a->status_id]);
                    DB::table('complaint_status_history')->insert([
                        'complaint_id' => $complaintId, 'from_status_id' => $c->status_id, 'to_status_id' => $a->status_id,
                        'changed_by' => $adminId, 'reason' => 'Assigned to ' . $office->office_name, 'created_at' => now(),
                    ]);
                }
            } else {
                if ($oldOffice === null) {
                    $this->fail('Assign a primary office before adding a coordinating office.');
                }
                if ($oldOffice === $officeId) {
                    $this->fail('', ['office_id' => 'This office is already the primary office.']);
                }
                $dup = DB::table('complaint_assignments')->where('complaint_id', $complaintId)->where('assignment_type', 'secondary')
                    ->where('is_current', 1)->where('to_office_id', $officeId)->exists();
                if ($dup) {
                    $this->fail('', ['office_id' => 'This office is already coordinating on this complaint.']);
                }
                DB::table('complaint_assignments')->insert([
                    'complaint_id' => $complaintId, 'assignment_type' => 'secondary', 'from_office_id' => null,
                    'to_office_id' => $officeId, 'assigned_by' => $adminId, 'reason' => $why,
                    'target_date' => $target, 'is_current' => 1, 'created_at' => now(),
                ]);
            }
            return [$c, $oldOffice, $target, $why];
        });

        // ---- After commit ----
        $ref = $c->reference_no;
        if ($type === 'primary') {
            $isReassign = $oldOffice !== null;
            $this->notifyOffice($officeId, $complaintId, $isReassign ? 'reassigned' : 'assigned',
                "Complaint $ref was " . ($isReassign ? 'reassigned' : 'assigned') . ' to your office.', $adminId);
            if ($isReassign) {
                $this->notifyOffice($oldOffice, $complaintId, 'reassigned', "Complaint $ref was reassigned to another office.", $adminId);
            }
            $this->mail->notifyOffice($officeId, $complaintId, $adminId,
                $isReassign ? 'Complaint reassigned to your office' : 'Complaint assigned to your office',
                ($isReassign ? 'RDAC reassigned this complaint to your office.' : 'RDAC assigned this complaint to your office.')
                    . ' Please acknowledge receipt and begin your review.',
                ['Reason' => $why, 'Target date' => $target]);
            if ($isReassign) {
                $this->mail->notifyOffice($oldOffice, $complaintId, $adminId,
                    'Complaint reassigned to another office',
                    'RDAC reassigned this complaint to another office. Your office no longer owns this case, so please stop work on it.',
                    ['Reason' => $why]);
            }
        } else {
            $this->notifyOffice($officeId, $complaintId, 'assigned', "Your office was added to coordinate on complaint $ref.", $adminId);
            $this->mail->notifyOffice($officeId, $complaintId, $adminId,
                'Your office was added as a coordinating office',
                'RDAC added your office as a coordinating office on this complaint. The primary responsible office is shown below.',
                ['Reason' => $why, 'Target date' => $target]);
        }
        $this->audit($adminId,
            $type === 'primary' ? ($oldOffice === null ? 'complaint_assigned' : 'complaint_reassigned') : 'complaint_coordination_added',
            $complaintId, ['office_id' => $officeId, 'type' => $type, 'from_office_id' => $oldOffice]);

        return $type === 'primary'
            ? ($oldOffice === null ? 'Assigned to ' : 'Reassigned to ') . $office->office_name . '.'
            : $office->office_name . ' added as a coordinating office.';
    }

    // ───────── Investigation update with photos ─────────

    /** @param UploadedFile[] $files */
    public function postInvestigationUpdate(int $complaintId, int $userId, string $role, ?int $officeId, string $details, array $files): string
    {
        $details = trim($details);
        if ($details === '') {
            $this->fail('', ['details' => 'Describe the investigation update.']);
        }
        if (mb_strlen($details) > 4000) {
            $this->fail('', ['details' => 'Keep the update within 4,000 characters.']);
        }
        $photos = $this->readPhotos($files);

        $saved = [];
        try {
            [$c, $actionId] = DB::transaction(function () use ($complaintId, $userId, $role, $officeId, $details, $photos, &$saved) {
                $c = DB::table('complaints as c')
                    ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                    ->where('c.complaint_id', $complaintId)->lockForUpdate()
                    ->first(['c.complaint_id', 'c.reference_no', 'c.current_office_id', 'c.deleted_at', 's.status_code']);
                if (! $c || $c->deleted_at !== null) {
                    abort(404);
                }
                if (! in_array($c->status_code, ['under_investigation', 'for_info'], true)) {
                    $this->fail('Updates can be added only while the complaint is under investigation or awaiting additional information.');
                }
                if ($c->status_code === 'under_investigation' && $photos === []) {
                    $this->fail('', ['photos' => 'Attach at least one photo of the investigation.']);
                }
                if ($role === 'field_office') {
                    $assigned = $officeId && DB::table('complaint_assignments')
                        ->where('complaint_id', $complaintId)->where('to_office_id', $officeId)->where('is_current', 1)->exists();
                    if (! $assigned) {
                        $this->fail('You are not authorized to update this complaint.');
                    }
                } elseif ($role !== 'admin') {
                    $this->fail('You are not authorized to update this complaint.');
                }

                $actionId = DB::table('complaint_actions')->insertGetId([
                    'complaint_id' => $complaintId, 'office_id' => $officeId ?: null, 'user_id' => $userId,
                    'action_type' => 'investigation_update', 'details' => $details,
                    'action_date' => now(), 'is_internal' => 1,
                ]);

                foreach ($photos as $p) {
                    $stored = bin2hex(random_bytes(16)) . '.' . $p['ext'];
                    $hash = hash_file('sha256', $p['file']->getRealPath()) ?: '';
                    $path = Storage::disk('local')->putFileAs("complaints/{$complaintId}", $p['file'], $stored);
                    if (! $path) {
                        throw new RuntimeException('Could not store an uploaded photo.');
                    }
                    $saved[] = $path;
                    DB::table('complaint_documents')->insert([
                        'complaint_id' => $complaintId, 'action_id' => $actionId, 'uploaded_by' => $userId,
                        'document_type' => 'photo', 'original_name' => $p['name'], 'stored_name' => $stored,
                        'file_path' => $path, 'mime_type' => $p['mime'], 'file_size' => $p['size'], 'sha256' => $hash,
                    ]);
                }
                DB::table('complaints')->where('complaint_id', $complaintId)->update(['updated_at' => now()]);
                return [$c, $actionId];
            });
        } catch (Throwable $e) {
            foreach ($saved as $path) {
                Storage::disk('local')->delete($path); // remove files whose DB rows were rolled back
            }
            throw $e;
        }

        // ---- After commit ----
        $n = count($photos);
        $forInfo = $c->status_code === 'for_info';
        $photoPhrase = $n > 0 ? " with $n photo" . ($n === 1 ? '' : 's') : '';
        $msg = ($forInfo ? 'Additional information' : 'An investigation update') . $photoPhrase . " was added to complaint {$c->reference_no}.";
        $curOffice = $c->current_office_id !== null ? (int) $c->current_office_id : null;

        if ($role === 'field_office') {
            $this->notifyAdmins($complaintId, 'update_added', $msg, $userId);
        }
        if ($curOffice !== null) {
            $this->notifyOffice($curOffice, $complaintId, 'update_added', $msg, $userId);
        }
        $bits = ['Photos attached' => (string) $n, 'Update' => $details];
        $photoText = "$n photo" . ($n === 1 ? '' : 's');
        if ($role === 'field_office') {
            $this->mail->notifyAdmins($complaintId, $userId, 'Investigation update with photos',
                $this->mail->officeName((int) $officeId) . " added an investigation update with $photoText.", $bits);
        } elseif ($curOffice !== null) {
            $this->mail->notifyOffice($curOffice, $complaintId, $userId, 'Investigation update from RDAC',
                "RDAC added an investigation update with $photoText.", $bits);
        }
        $this->audit($userId, 'complaint_update_added', $complaintId, ['action_id' => $actionId, 'photo_count' => $n]);

        return $forInfo
            ? 'Additional information saved' . ($n > 0 ? " with $photoText" : '') . '.'
            : "Investigation update saved with $photoText.";
    }

    /** @param UploadedFile[] $files */
    private function readPhotos(array $files): array
    {
        $files = array_values(array_filter($files, fn ($f) => $f instanceof UploadedFile));
        if (count($files) > self::PHOTO_MAX_COUNT) {
            $this->fail('', ['photos' => 'You can attach up to ' . self::PHOTO_MAX_COUNT . ' photos per update.']);
        }
        $out = [];
        foreach ($files as $f) {
            if (! $f->isValid()) {
                $big = in_array($f->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
                $this->fail('', ['photos' => $big ? 'Each photo must be 5 MB or smaller.' : 'One of the photos could not be uploaded. Try again.']);
            }
            if ($f->getSize() > self::PHOTO_MAX_BYTES) {
                $this->fail('', ['photos' => 'Each photo must be 5 MB or smaller.']);
            }
            $mime = (string) $f->getMimeType(); // sniffed from file contents, not the client's claim
            if (! isset(self::PHOTO_MIMES[$mime])) {
                $this->fail('', ['photos' => 'Use JPEG, PNG, WebP or GIF photos only.']);
            }
            $orig = mb_substr(basename($f->getClientOriginalName()), 0, 255);
            $out[] = [
                'file' => $f, 'mime' => $mime, 'ext' => self::PHOTO_MIMES[$mime], 'size' => (int) $f->getSize(),
                'name' => $orig !== '' ? $orig : 'photo.' . self::PHOTO_MIMES[$mime],
            ];
        }
        return $out;
    }

    // ───────── Edit / delete the original record ─────────

    /** $f keys: title, category_id, description, channel, received_at, incident, province_id, municipality,
     *  barangay, specific, complainant_name, complainant_contact, complainant_email, anonymous, priority,
     *  target_date, and optionally outside (is_outside_region). */
    public function updateComplaint(int $complaintId, int $userId, array $f): string
    {
        $c = DB::transaction(function () use ($complaintId, $userId, $f) {
            $c = DB::table('complaints as c')
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->where('c.complaint_id', $complaintId)->lockForUpdate()
                ->first(['c.*', 's.status_code']);
            if (! $c || $c->deleted_at !== null) {
                abort(404);
            }
            $perm = $this->ownerPermissions((int) $c->recorded_by, $userId, $c->status_code);
            if (! $perm['can_edit']) {
                $this->fail($perm['restrict_reason'] ?: 'You cannot edit this complaint.');
            }

            $set = [
                'title' => $f['title'], 'category_id' => $f['category_id'], 'description' => $f['description'],
                'received_channel' => $f['channel'], 'received_at' => $f['received_at'],
                'incident_datetime' => $f['incident'], 'province_id' => $f['province_id'],
                'municipality' => $f['municipality'], 'barangay' => $f['barangay'], 'specific_location' => $f['specific'],
                'complainant_name' => $f['complainant_name'], 'complainant_contact' => $f['complainant_contact'],
                'complainant_email' => $f['complainant_email'], 'is_anonymous' => $f['anonymous'],
                'priority' => $f['priority'], 'target_date' => $f['target_date'], 'updated_at' => now(),
            ];
            if (array_key_exists('outside', $f)) {
                $set['is_outside_region'] = $f['outside'];
            }
            DB::table('complaints')->where('complaint_id', $complaintId)->update($set);
            return $c;
        });

        $map = [
            'title' => 'title', 'category_id' => 'category_id', 'description' => 'description',
            'received_channel' => 'channel', 'received_at' => 'received_at', 'incident_datetime' => 'incident',
            'province_id' => 'province_id', 'municipality' => 'municipality', 'barangay' => 'barangay',
            'specific_location' => 'specific', 'complainant_name' => 'complainant_name',
            'complainant_contact' => 'complainant_contact', 'complainant_email' => 'complainant_email',
            'is_anonymous' => 'anonymous', 'priority' => 'priority', 'target_date' => 'target_date',
        ];
        $changed = [];
        foreach ($map as $col => $key) {
            if ((string) ($c->$col ?? '') !== (string) ($f[$key] ?? '')) {
                $changed[$col] = ['from' => $c->$col ?? null, 'to' => $f[$key] ?? null];
            }
        }
        $this->audit($userId, 'complaint_edited', $complaintId, [
            'reference_no' => $c->reference_no, 'status' => $c->status_code, 'changes' => $changed,
        ]);
        return "Complaint {$c->reference_no} was updated.";
    }

    public function softDelete(int $complaintId, int $userId): string
    {
        $c = DB::transaction(function () use ($complaintId, $userId) {
            $c = DB::table('complaints as c')
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->where('c.complaint_id', $complaintId)->lockForUpdate()
                ->first(['c.complaint_id', 'c.reference_no', 'c.recorded_by', 'c.deleted_at', 's.status_code']);
            if (! $c || $c->deleted_at !== null) {
                abort(404);
            }
            $perm = $this->ownerPermissions((int) $c->recorded_by, $userId, $c->status_code);
            if (! $perm['can_delete']) {
                $this->fail($perm['restrict_reason'] ?: 'You cannot delete this complaint.');
            }
            DB::table('complaints')->where('complaint_id', $complaintId)->update(['deleted_at' => now(), 'deleted_by' => $userId]);
            return $c;
        });

        $this->audit($userId, 'complaint_deleted', $complaintId, [
            'reference_no' => $c->reference_no, 'status' => $c->status_code, 'soft_delete' => true,
        ]);
        return "Complaint {$c->reference_no} was deleted.";
    }

    // ───────── Photo download access ─────────

    public function documentForViewer(int $documentId, string $role, ?int $officeId): ?object
    {
        $row = DB::table('complaint_documents')->where('document_id', $documentId)
            ->first(['document_id', 'complaint_id', 'file_path', 'mime_type', 'original_name', 'is_deleted']);
        if (! $row || (int) $row->is_deleted === 1) {
            return null;
        }
        if ($role === 'field_office') {
            $ok = DB::table('complaints as c')
                ->where('c.complaint_id', $row->complaint_id)->whereNull('c.deleted_at')
                ->where(function ($q) use ($officeId) {
                    $q->where('c.current_office_id', $officeId)->orWhereExists(function ($s) use ($officeId) {
                        $s->selectRaw('1')->from('complaint_assignments as ax')
                            ->whereColumn('ax.complaint_id', 'c.complaint_id')
                            ->where('ax.to_office_id', $officeId)->where('ax.is_current', 1);
                    });
                })->exists();
            if (! $ok) {
                return null;
            }
        } elseif ($role !== 'admin') {
            return null;
        }
        return Storage::disk('local')->exists($row->file_path) ? $row : null;
    }

    // ───────── Notifications / audit ─────────

    private function notifyOffice(int $officeId, int $complaintId, string $type, string $message, int $excludeUserId = 0): void
    {
        try {
            DB::insert(
                "INSERT INTO notifications (user_id, complaint_id, notif_type, message)
                 SELECT user_id, ?, ?, ? FROM users
                 WHERE office_id = ? AND role = 'field_office' AND is_active = 1 AND user_id <> ?",
                [$complaintId, $type, mb_substr($message, 0, 300), $officeId, $excludeUserId]
            );
        } catch (Throwable $e) {
            Log::error('notifyOffice: ' . $e->getMessage());
        }
    }

    private function notifyAdmins(int $complaintId, string $type, string $message, int $excludeUserId = 0): void
    {
        try {
            DB::insert(
                "INSERT INTO notifications (user_id, complaint_id, notif_type, message)
                 SELECT user_id, ?, ?, ? FROM users
                 WHERE role = 'admin' AND is_active = 1 AND user_id <> ?",
                [$complaintId, $type, mb_substr($message, 0, 300), $excludeUserId]
            );
        } catch (Throwable $e) {
            Log::error('notifyAdmins: ' . $e->getMessage());
        }
    }

    /** TODO: replace with your write_audit() equivalent. */
    private function audit(int $userId, string $action, int $complaintId, array $data): void
    {
        Log::info('complaint audit', compact('userId', 'action', 'complaintId', 'data'));
    }
}