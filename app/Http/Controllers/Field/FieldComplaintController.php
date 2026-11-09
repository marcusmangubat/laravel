<?php

// in acknowledge-methods.php added to ComplaintWorkflow.

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use App\Services\ComplaintWorkflow;
use App\Services\ComplaintAdminNotifier;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class FieldComplaintController extends Controller
{
    private const ROLE = 'field_office';

    public function __construct(private ComplaintWorkflow $wf) {}

    private function officeId(): int
{
    $officeId = auth()->user()->office_id ?? session('office_id');

    abort_if(!$officeId, 403, 'No field office is assigned to your account.');

    return (int) $officeId;
}

    /** Complaint visible to this office (primary or current coordinating), or 404. */
private function findScoped(int $id): object
{
    $officeId = $this->officeId();

    $c = DB::table('complaints as c')
        ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
        ->leftJoin('complaint_categories as cc', 'cc.category_id', '=', 'c.category_id')
        ->leftJoin('provinces as p', 'p.province_id', '=', 'c.province_id')
        ->leftJoin('offices as o', 'o.office_id', '=', 'c.current_office_id')
        ->where('c.complaint_id', $id)
        ->whereNull('c.deleted_at')
        ->where(function ($q) use ($officeId) {
            $q->where('c.current_office_id', $officeId)
              ->orWhereExists(function ($sub) use ($officeId) {
                  $sub->selectRaw('1')
                      ->from('complaint_assignments as a')
                      ->whereColumn('a.complaint_id', 'c.complaint_id')
                      ->where('a.to_office_id', $officeId)
                      ->where('a.is_current', 1);
              });
        })
        ->selectRaw("
            c.*,
            s.status_code,
            s.status_name,
            cc.category_name,
            p.province_name,
            o.office_name,
            (c.target_date IS NOT NULL
                AND c.target_date < CURDATE()
                AND s.status_code NOT IN ('resolved', 'closed')
            ) AS is_overdue
        ")
        ->first();

    abort_if(!$c, 404, 'Complaint not found or you do not have permission to view it.');

    return $c;
}

    private function sqlDateTime(?string $v): ?string
    {
        return $v ? Carbon::parse($v)->format('Y-m-d H:i:s') : null;
    }

    public function show(int $id)
    {
        $c = $this->findScoped($id);
        $officeId = $this->officeId();

        return Inertia::render('field/FieldComplaintView', [
            'complaint' => $c,
            'is_primary' => (int) $c->current_office_id === $officeId,
            'options' => [
                'categories' => DB::table('complaint_categories')->where('is_active', 1)
                    ->orderBy('category_name')->get(['category_id', 'category_name']),
                'provinces' => DB::table('provinces')->where('is_active', 1)
                    ->orderBy('province_name')->get(['province_id', 'province_name']),
            ],
            'view' => [
                'transitions' => $this->wf->allowedTransitions((int) $c->status_id, self::ROLE),
                'can_acknowledge' => $this->wf->canAcknowledge($id, $officeId),
                'can_post_update' => $this->wf->canPostUpdate($c->status_code, self::ROLE, $officeId, $id),
                'photos_required' => $c->status_code === 'under_investigation',
                'history' => $this->wf->history($id),
                'assignments' => $this->wf->assignments($id),
                'actions' => $this->wf->actions($id),
            ] + $this->wf->ownerPermissions((int) $c->recorded_by, (int) auth()->id(), $c->status_code),
        ]);
    }

    /** Investigation photo, only for offices that can see the complaint. */
    public function document(int $id)
    {
        $doc = $this->wf->documentForViewer($id, self::ROLE, $this->officeId());
        abort_if(! $doc, 404);

        return Storage::disk('local')->response($doc->file_path, $doc->original_name, [
            'Content-Type' => $doc->mime_type,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function acknowledge(Request $request, int $id)
    {
        $this->findScoped($id);
        $msg = $this->wf->acknowledge($id, (int) auth()->id(), $this->officeId());

        app(ComplaintAdminNotifier::class)->notify($id, 'acknowledged', (int) auth()->id(), [], $request->ip());

        return back()->with('success', $msg);
    }

    public function status(Request $request, int $id)
    {
        $c = $this->findScoped($id);   // $c->status_name is the status BEFORE the change
        $v = $request->validate([
            'from_status_id' => ['required', 'integer'],
            'to_status_id' => ['required', 'integer'],
            'reason' => ['required', 'string', 'max:500'],
        ], [
            'reason.required' => 'Reason is required.',
            'reason.max' => 'Reason must not exceed 500 characters.',
        ]);

        // from_status_id lets the workflow reject a stale page (409 in the old PHP)
        $msg = $this->wf->changeStatus(
            $id, (int) $v['from_status_id'], (int) $v['to_status_id'],
            (int) auth()->id(), self::ROLE, $v['reason'], $this->officeId()
        );

        app(ComplaintAdminNotifier::class)->notify($id, 'status_changed', (int) auth()->id(), [
            'from_status' => $c->status_name,
            'reason'      => $v['reason'],
        ], $request->ip());

        return back()->with('success', $msg);
    }

    public function postUpdate(Request $request, int $id)
    {
        $this->findScoped($id);
        // The service validates details, photo count, size and real MIME type, and requires
        // photos while under investigation.
        $photos = Arr::wrap($request->file('photos'));
        $msg = $this->wf->postInvestigationUpdate(
            $id, (int) auth()->id(), self::ROLE, $this->officeId(),
            (string) $request->input('details', ''), $photos
        );

        // Becomes "Additional information submitted" automatically when the status is For Additional Information
        app(ComplaintAdminNotifier::class)->notify($id, 'update_added', (int) auth()->id(), [
            'details'     => (string) $request->input('details', ''),
            'photo_count' => count($photos),
        ], $request->ip());

        return back()->with('success', $msg);
    }

   public function edit(Request $request, int $id)
    {
        $c = $this->findScoped($id);   // $c holds the values BEFORE the edit

        // If your list page's store() already has these rules (a FormRequest?), reuse them here.
        $v = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'category_id' => ['nullable', 'integer', Rule::exists('complaint_categories', 'category_id')],
            'priority' => ['required', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'description' => ['required', 'string'],
            'received_channel' => ['required', Rule::in(array_keys(ComplaintWorkflow::CHANNELS))],
            'received_at' => ['required', 'date', 'before_or_equal:now'],
            'incident_datetime' => ['nullable', 'date', 'before_or_equal:now'],
            'target_date' => ['nullable', 'date'],
            'province_id' => ['nullable', 'integer', Rule::exists('provinces', 'province_id')],
            'municipality' => ['nullable', 'string', 'max:100'],
            'barangay' => ['nullable', 'string', 'max:100'],
            'specific_location' => ['nullable', 'string', 'max:255'],
            'is_anonymous' => ['boolean'],
            'complainant_name' => ['nullable', 'string', 'max:150'],
            'complainant_contact' => ['nullable', 'string', 'max:100'],
            'complainant_email' => ['nullable', 'email', 'max:150'],
        ]);

        $anon = ! empty($v['is_anonymous']);
        $msg = $this->wf->updateComplaint($id, (int) auth()->id(), [
            'title' => $v['title'],
            'category_id' => $v['category_id'] ?? null,
            'description' => $v['description'],
            'channel' => $v['received_channel'],
            'received_at' => $this->sqlDateTime($v['received_at']),
            'incident' => $this->sqlDateTime($v['incident_datetime'] ?? null),
            'province_id' => $v['province_id'] ?? null,
            'municipality' => $v['municipality'] ?? null,
            'barangay' => $v['barangay'] ?? null,
            'specific' => $v['specific_location'] ?? null,
            'complainant_name' => $anon ? null : ($v['complainant_name'] ?? null),
            'complainant_contact' => $anon ? null : ($v['complainant_contact'] ?? null),
            'complainant_email' => $anon ? null : ($v['complainant_email'] ?? null),
            'anonymous' => $anon ? 1 : 0,
            'priority' => $v['priority'],
            'target_date' => $v['target_date'] ?? null,
            // 'outside' is omitted on purpose: the edit form has no such field, so the flag stays as it was
        ]);

        // Work out exactly what the field office changed
        $after = [
            'title' => $v['title'],
            'category_id' => $v['category_id'] ?? null,
            'priority' => $v['priority'],
            'description' => $v['description'],
            'received_channel' => $v['received_channel'],
            'received_at' => $this->sqlDateTime($v['received_at']),
            'incident_datetime' => $this->sqlDateTime($v['incident_datetime'] ?? null),
            'target_date' => $v['target_date'] ?? null,
            'province_id' => $v['province_id'] ?? null,
            'municipality' => $v['municipality'] ?? null,
            'barangay' => $v['barangay'] ?? null,
            'specific_location' => $v['specific_location'] ?? null,
            'is_anonymous' => $anon ? 1 : 0,
            'complainant_name' => $anon ? null : ($v['complainant_name'] ?? null),
            'complainant_contact' => $anon ? null : ($v['complainant_contact'] ?? null),
            'complainant_email' => $anon ? null : ($v['complainant_email'] ?? null),
        ];
        $changes = ComplaintAdminNotifier::diff((array) $c, $after);

        if ($changes) {
            app(ComplaintAdminNotifier::class)->notify($id, 'edited', (int) auth()->id(), ['changes' => $changes], $request->ip());
        }

        return back()->with('success', $msg);
    }

    public function destroy(Request $request, int $id)
    {
        $c = $this->findScoped($id);   // grab the reference and title before the delete
        $msg = $this->wf->softDelete($id, (int) auth()->id());

        app(ComplaintAdminNotifier::class)->notify($id, 'deleted', (int) auth()->id(), [
            'reference_no' => $c->reference_no,
            'title'        => $c->title,
        ], $request->ip());

        return redirect('/field/complaints')->with('success', $msg);
    }
}