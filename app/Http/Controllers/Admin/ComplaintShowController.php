<?php

// app/Http/Controllers/Admin/ComplaintShowController.php
// Replaces admin/complaint-view.php and ajax/complaint_{status,assign,update,edit,delete}.php.
// Feeds resources/js/pages/admin/complaints/show.tsx.

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ComplaintWorkflow;
use App\Services\ComplaintAdminNotifier;
use App\Services\ComplaintOfficeNotifier;
use App\Support\ComplaintFields;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use App\Http\Requests\Admin\StoreComplaintRequest;

/*
 * routes/web.php  (inside your admin auth group)
 *
 * Route::get   ('/admin/complaints/{id}',         [ComplaintShowController::class, 'show']);
 * Route::put   ('/admin/complaints/{id}',         [ComplaintShowCont   roller::class, 'update']);
 * Route::delete('/admin/complaints/{id}',         [ComplaintShowController::class, 'destroy']);
 * Route::post  ('/admin/complaints/{id}/status',  [ComplaintShowController::class, 'status']);
 * Route::post  ('/admin/complaints/{id}/assign',  [ComplaintShowController::class, 'assign']);
 * Route::post  ('/admin/complaints/{id}/updates', [ComplaintShowController::class, 'postUpdate']);
 * Route::get   ('/admin/documents/{id}',          [ComplaintShowController::class, 'document']);
 *
 * CSRF: Inertia sends the XSRF cookie automatically, so the csrf_token hidden inputs are gone.
 */
class ComplaintShowController extends Controller
{
    private const ROLE = 'admin';

    public function __construct(private ComplaintWorkflow $wf)
    {
    }

    public function show(Request $request, int $id): Response
    {
        $c = DB::table('complaints as c')
            ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
            ->leftJoin('complaint_categories as cc', 'cc.category_id', '=', 'c.category_id')
            ->leftJoin('provinces as p', 'p.province_id', '=', 'c.province_id')
            ->leftJoin('offices as o', 'o.office_id', '=', 'c.current_office_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'c.recorded_by')
            ->where('c.complaint_id', $id)
            ->whereNull('c.deleted_at')
            ->first([
                'c.*', 's.status_code', 's.status_name', 'cc.category_name', 'p.province_name',
                'o.office_name', 'u.full_name as recorder_name',
            ]);
        abort_if(! $c, 404);

        $isOverdue = $c->target_date
            && $c->target_date < now()->toDateString()
            && ! in_array($c->status_code, ['resolved', 'closed'], true);

        $owner = $this->wf->ownerPermissions((int) $c->recorded_by, (int) $request->user()->getKey(), $c->status_code);

        return Inertia::render('admin/complaints/show', [
            'complaint' => [
                'complaint_id' => $c->complaint_id,
                'reference_no' => $c->reference_no,
                'title' => $c->title,
                'description' => $c->description,
                'status_id' => $c->status_id,
                'status_code' => $c->status_code,
                'status_name' => $c->status_name,
                'priority' => $c->priority,
                'category_name' => $c->category_name,
                'received_channel' => $c->received_channel,
                'received_at' => $c->received_at,
                'incident_datetime' => $c->incident_datetime,
                'target_date' => $c->target_date,
                'office_name' => $c->office_name,
                'recorder_name' => $c->recorder_name,
                'updated_at' => $c->updated_at,
                'resolution_summary' => $c->resolution_summary,
                'is_overdue' => (bool) $isOverdue,
                'specific_location' => $c->specific_location,
                'barangay' => $c->barangay,
                'municipality' => $c->municipality,
                'province_name' => $c->province_name,
                'is_anonymous' => (bool) $c->is_anonymous,
                'complainant_name' => $c->complainant_name,
                'complainant_contact' => $c->complainant_contact,
                'complainant_email' => $c->complainant_email,
            ],
            'history' => $this->wf->history($id),
            'assignments' => $this->wf->assignments($id),
            'actions' => $this->wf->actions($id),
            'transitions' => $this->wf->allowedTransitions((int) $c->status_id, self::ROLE),
            'assignOffices' => DB::table('offices')
                ->where('is_active', 1)->where('can_receive_assignments', 1)
                ->orderBy('office_name')->get(['office_id', 'office_name']),
            'categories' => DB::table('complaint_categories')->where('is_active', 1)
                ->orderBy('category_name')->get(['category_id', 'category_name']),
            'provinces' => DB::table('provinces')->where('is_active', 1)
                ->orderBy('province_name')->get(['province_id', 'province_name']),
            'edit' => [
                'title' => $c->title,
                'category_id' => (string) ($c->category_id ?? ''),
                'priority' => $c->priority,
                'description' => $c->description,
                'received_channel' => $c->received_channel,
                'received_at' => $c->received_at ? Carbon::parse($c->received_at)->format('Y-m-d\TH:i') : '',
                'incident_datetime' => $c->incident_datetime ? Carbon::parse($c->incident_datetime)->format('Y-m-d\TH:i') : '',
                'target_date' => $c->target_date ? substr($c->target_date, 0, 10) : '',
                'province_id' => (string) ($c->province_id ?? ''),
                'municipality' => $c->municipality ?? '',
                'barangay' => $c->barangay ?? '',
                'specific_location' => $c->specific_location ?? '',
                'is_anonymous' => (bool) $c->is_anonymous,
                'complainant_name' => $c->complainant_name ?? '',
                'complainant_contact' => $c->complainant_contact ?? '',
                'complainant_email' => $c->complainant_email ?? '',
            ],
            'permissions' => [
                'can_assign' => in_array($c->status_code, ComplaintWorkflow::ASSIGNABLE, true),
                'can_update' => $this->wf->canPostUpdate($c->status_code, self::ROLE, null, $id),
                'photos_required' => $c->status_code === 'under_investigation',
                'can_edit' => $owner['can_edit'],
                'can_delete' => $owner['can_delete'],
                'is_owner' => $owner['is_owner'],
                'restrict_reason' => $owner['restrict_reason'],
            ],
        ]);
    }

    public function status(Request $request, int $id): RedirectResponse
    {
        $data = $request->validate([
            'to_status_id' => ['required', 'integer'],
            'from_status_id' => ['required', 'integer'],
            'reason' => ['required', 'string', 'max:500'],
        ], [
            'reason.required' => 'Reason is required.',
            'reason.max' => 'Reason must not exceed 500 characters.',
        ]);

        $msg = $this->wf->changeStatus(
            $id, (int) $data['from_status_id'], (int) $data['to_status_id'],
            (int) $request->user()->getKey(), self::ROLE, $data['reason']
        );
        return back()->with('success', $msg);
    }

    public function assign(Request $request, int $id): RedirectResponse
    {
        $data = $request->validate([
            'office_id' => ['required', 'integer'],
            'assignment_type' => ['required', Rule::in(['primary', 'secondary'])],
            'target_date' => ['nullable', 'date_format:Y-m-d'],
            'reason' => ['required', 'string', 'max:500'],
        ], [
            'reason.required' => 'Reason is required.',
            'reason.max' => 'Reason must not exceed 500 characters.',
            'office_id.required' => 'Select an office.',
            'assignment_type.in' => 'Choose primary or secondary.',
            'target_date.date_format' => 'Enter a valid target date.',
        ]);

        $msg = $this->wf->assign(
            $id, (int) $data['office_id'], $data['assignment_type'], $data['reason'],
            (string) ($data['target_date'] ?? ''), (int) $request->user()->getKey()
        );
        return back()->with('success', $msg);
    }

    public function postUpdate(Request $request, int $id): RedirectResponse
    {
        $request->validate(['details' => ['required', 'string']], ['details.required' => 'Describe the investigation update.']);

        $c = DB::table('complaints as c')->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
            ->where('c.complaint_id', $id)->whereNull('c.deleted_at')->first(['s.status_code']);
        abort_if(! $c, 404);
        abort_unless($this->wf->canPostUpdate($c->status_code, self::ROLE, null, $id), 403);

        $msg = $this->wf->postInvestigationUpdate(
            $id, (int) $request->user()->getKey(), self::ROLE, null,
            (string) $request->input('details'), $request->file('photos', [])
        );
        return back()->with('success', $msg);
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        // Same rules and messages as cf_from_post() in complaint_fields.php
        $fields = ComplaintFields::fromInput($request->all());

        $msg = $this->wf->updateComplaint($id, (int) $request->user()->getKey(), $fields);
        return back()->with('success', $msg);
    }

    public function destroy(Request $request, int $id): RedirectResponse
    {
        $msg = $this->wf->softDelete($id, (int) $request->user()->getKey());
        return redirect('/admin/complaints')->with('success', $msg);
    }

    /** Replaces document.php: serves a photo only if the viewer is allowed to see it. */
    public function document(Request $request, int $id): BinaryFileResponse
    {
        $u = $request->user();
        $doc = $this->wf->documentForViewer($id, (string) $u->role, $u->office_id ?? null);
        abort_if(! $doc, 404);

        return response()->file(Storage::disk('local')->path($doc->file_path), [
            'Content-Type' => $doc->mime_type,
            'Content-Disposition' => 'inline; filename="' . str_replace(['"', "\r", "\n"], '', (string) $doc->original_name) . '"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}