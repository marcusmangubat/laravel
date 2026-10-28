<?php
// app/Http/Controllers/Admin/ComplaintController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreComplaintRequest;
use App\Models\AuditLog;
use App\Models\Complaint;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ComplaintController extends Controller
{
    private const PER_PAGE = 10;

    /**
     * Replaces: complaints.php (page) + ajax/complaints_list.php.
     * Filters come in as ?q=...&status_id=...&page=2 and go straight into the query.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        $f = $request->validate([
            'q'           => ['nullable', 'string', 'max:100'],
            'status_id'   => ['nullable', 'integer', 'exists:complaint_statuses,status_id'],
            'category_id' => ['nullable', 'integer', 'exists:complaint_categories,category_id'],
            'province_id' => ['nullable', 'integer', 'exists:provinces,province_id'],
            'office_id'   => ['nullable', 'regex:/^(none|\d+)$/'],   // "none" = not yet assigned
            'from'        => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'to'          => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:from'],
            'page'        => ['nullable', 'integer', 'min:1'],
        ]);

        $complaints = DB::table('complaints as c')
            ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
            ->leftJoin('complaint_categories as cc', 'cc.category_id', '=', 'c.category_id')
            ->leftJoin('provinces as p', 'p.province_id', '=', 'c.province_id')
            ->leftJoin('offices as o', 'o.office_id', '=', 'c.current_office_id')
            ->whereNull('c.deleted_at')

            // Search reference, subject or location (escape % and _ so they are searched literally)
            ->when($f['q'] ?? null, function ($query, $term) {
                $like = '%' . addcslashes($term, '%_\\') . '%';
                $query->where(fn ($w) => $w
                    ->where('c.reference_no', 'like', $like)
                    ->orWhere('c.title', 'like', $like)
                    ->orWhere('c.municipality', 'like', $like)
                    ->orWhere('c.barangay', 'like', $like));
            })
            ->when($f['status_id'] ?? null,   fn ($q, $v) => $q->where('c.status_id', $v))
            ->when($f['category_id'] ?? null, fn ($q, $v) => $q->where('c.category_id', $v))
            ->when($f['province_id'] ?? null, fn ($q, $v) => $q->where('c.province_id', $v))
            ->when($f['office_id'] ?? null,   fn ($q, $v) => $v === 'none'
                ? $q->whereNull('c.current_office_id')
                : $q->where('c.current_office_id', $v))
            ->when($f['from'] ?? null, fn ($q, $d) => $q->where('c.received_at', '>=', $d . ' 00:00:00'))
            ->when($f['to'] ?? null,   fn ($q, $d) => $q->where('c.received_at', '<=', $d . ' 23:59:59'))

            ->orderByDesc('c.updated_at')
            ->orderByDesc('c.complaint_id')
            ->select([
                'c.complaint_id', 'c.reference_no', 'c.title', 'c.priority', 'c.received_at',
                'c.municipality',
                's.status_code', 's.status_name',
                'cc.category_name', 'p.province_name', 'o.office_name',
                DB::raw("(c.target_date IS NOT NULL AND c.target_date < CURDATE()
                          AND s.status_code NOT IN ('resolved','closed')) AS is_overdue"),
            ])
            ->paginate(self::PER_PAGE)
            ->withQueryString();   // keeps filters in the Next/Previous links

        // Your old page clamped the page number (e.g. ?page=99 became the last page).
        // paginate() would show an empty table instead, so redirect to the last page.
        if ($complaints->currentPage() > $complaints->lastPage()) {
            return redirect()->route('admin.complaints', array_merge(
                $request->query(),
                ['page' => $complaints->lastPage()]
            ));
        }

        return Inertia::render('admin/complaints', [
            'complaints' => $complaints,
            
            'filters'    => [
                'q'           => $f['q'] ?? '',
                'status_id'   => $f['status_id'] ?? '',
                'category_id' => $f['category_id'] ?? '',
                'province_id' => $f['province_id'] ?? '',
                'office_id'   => $f['office_id'] ?? '',
                'from'        => $f['from'] ?? '',
                'to'          => $f['to'] ?? '',
            ],
            // Dropdown lists. Closures so they are skipped on partial reloads.
            'options' => fn () => [
                'statuses'   => DB::table('complaint_statuses')->orderBy('sort_order')->get(['status_id', 'status_name']),
                'categories' => DB::table('complaint_categories')->where('is_active', 1)->orderBy('category_name')->get(['category_id', 'category_name']),
                'provinces'  => DB::table('provinces')->where('is_active', 1)->orderBy('province_name')->get(['province_id', 'province_name']),
                'offices'    => DB::table('offices')->where('is_active', 1)->orderBy('office_name')->get(['office_id', 'office_name']),
            ],
        ]);
    }

    /**
     * Replaces: ajax/complaint_create.php.
     * Validation lives in StoreComplaintRequest; CSRF and login checks are middleware.
     */
    public function store(StoreComplaintRequest $request): RedirectResponse
    {
        $v    = $request->validated();
        $anon = (bool) ($v['is_anonymous'] ?? false);
        $user = $request->user();

        // Everything below succeeds together or not at all.
        $complaint = DB::transaction(function () use ($v, $anon, $user, $request) {

            // 1. Next reference number, e.g. RDAC4A-2026-000005.
            //    lockForUpdate() makes two simultaneous requests wait their turn,
            //    so two complaints can never receive the same number.
            $year = (int) now()->format('Y');
            DB::table('reference_counters')->insertOrIgnore(['counter_year' => $year, 'last_number' => 0]);
            $last = DB::table('reference_counters')->where('counter_year', $year)->lockForUpdate()->value('last_number');
            $next = $last + 1;
            DB::table('reference_counters')->where('counter_year', $year)->update(['last_number' => $next]);
            $reference = sprintf('RDAC4A-%d-%06d', $year, $next);

            // 2. The complaint itself (status 1 = "Recorded")
            $complaint = Complaint::create([
                'reference_no'        => $reference,
                'title'               => $v['title'],
                'category_id'         => $v['category_id'] ?? null,
                'description'         => $v['description'],
                'received_channel'    => $v['received_channel'],
                'received_at'         => $v['received_at'],
                'incident_datetime'   => $v['incident_datetime'] ?? null,
                'province_id'         => $v['province_id'] ?? null,
                'municipality'        => $v['municipality'] ?? null,
                'barangay'            => $v['barangay'] ?? null,
                'specific_location'   => $v['specific_location'] ?? null,
                'is_anonymous'        => $anon,
                'complainant_name'    => $anon ? null : ($v['complainant_name'] ?? null),
                'complainant_contact' => $anon ? null : ($v['complainant_contact'] ?? null),
                'complainant_email'   => $anon ? null : ($v['complainant_email'] ?? null),
                'status_id'           => 1,
                'priority'            => $v['priority'] ?? 'normal',
                'target_date'         => $v['target_date'] ?? null,
                'recorded_by'         => $user->user_id,
            ]);

            // 3. First entry in the status history
            DB::table('complaint_status_history')->insert([
                'complaint_id'   => $complaint->complaint_id,
                'from_status_id' => null,
                'to_status_id'   => 1,
                'changed_by'     => $user->user_id,
                'reason'         => 'Complaint recorded',
                'created_at'     => now(),
            ]);

            // 4. Audit trail
            AuditLog::create([
                'user_id'     => $user->user_id,
                'action'      => 'complaint_recorded',
                'entity_type' => 'complaints',
                'entity_id'   => $complaint->complaint_id,
                'new_values'  => ['channel' => $v['received_channel'], 'reference_no' => $reference],
                'ip_address'  => $request->ip(),
                'user_agent'  => substr((string) $request->userAgent(), 0, 255),
            ]);

            return $complaint;
        });

        // "flash" message: shown once on the next page, then gone.
        return back()->with('success', "Complaint recorded. Reference number: {$complaint->reference_no}");
    }
}