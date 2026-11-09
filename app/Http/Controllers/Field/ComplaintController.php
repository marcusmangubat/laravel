<?php

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use App\Http\Requests\Field\StoreFieldComplaintRequest;
use App\Models\Complaint;
use App\Services\ComplaintWorkflow;
use App\Services\ComplaintAdminNotifier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Field office complaints (was field/complaints.php + ajax/complaints_list.php + ajax/complaint_create.php).
 * Same pattern as the admin page: Inertia props in, flash message out.
 * Every query is scoped to the logged-in user's own office; nothing about the office comes from the browser.
 */
class ComplaintController extends Controller
{
    private const PER_PAGE = 10;

    /** GET /field/complaints */
    public function index(Request $request): Response
    {
        $user     = $request->user();
        $officeId = (int) $user->office_id;
        $today    = now()->toDateString();

        // On failure Laravel redirects back with errors.from / errors.to, which the page shows.
        $toRules = ['nullable', 'date_format:Y-m-d', 'before_or_equal:' . $today];
        if ($request->filled('from')) {
            $toRules[] = 'after_or_equal:from';
        }
        $request->validate([
            'q'         => ['nullable', 'string', 'max:100'],
            'status_id' => ['nullable', 'integer'],
            'from'      => ['nullable', 'date_format:Y-m-d', 'before_or_equal:' . $today],
            'to'        => $toRules,
        ], [
            'from.date_format'      => 'Enter a valid start date.',
            'from.before_or_equal'  => 'Dates cannot be in the future.',
            'to.date_format'        => 'Enter a valid end date.',
            'to.before_or_equal'    => 'Dates cannot be in the future.',
            'to.after_or_equal'     => 'The start date must be on or before the end date.',
        ]);

        $q        = trim((string) $request->query('q', ''));
        $statusId = (int) $request->query('status_id', 0);
        $from     = (string) $request->query('from', '');
        $to       = (string) $request->query('to', '');

        $query = Complaint::query()
            ->visibleToOffice($officeId)
            ->whereNull('complaints.deleted_at')
            ->join('complaint_statuses as s', 's.status_id', '=', 'complaints.status_id')
            ->leftJoin('complaint_categories as cc', 'cc.category_id', '=', 'complaints.category_id');

        if ($q !== '') {
            $like = '%' . addcslashes($q, '%_\\') . '%';
            $query->where(function ($w) use ($like) {
                $w->where('complaints.reference_no', 'like', $like)
                  ->orWhere('complaints.title', 'like', $like)
                  ->orWhere('complaints.municipality', 'like', $like)
                  ->orWhere('complaints.barangay', 'like', $like);
            });
        }
        if ($statusId > 0) $query->where('complaints.status_id', $statusId);
        if ($from !== '')  $query->where('complaints.received_at', '>=', "$from 00:00:00");
        if ($to !== '')    $query->where('complaints.received_at', '<=', "$to 23:59:59");

        $complaints = $query
            ->select([
                'complaints.complaint_id', 'complaints.reference_no', 'complaints.title', 'complaints.priority',
                'complaints.received_at', 'complaints.municipality',
                's.status_code', 's.status_name', 'cc.category_name',
            ])
            ->selectRaw("(complaints.target_date IS NOT NULL AND complaints.target_date < ? AND s.status_code NOT IN ('resolved','closed')) AS is_overdue", [$today])
            ->orderByDesc('complaints.updated_at')
            ->orderByDesc('complaints.complaint_id')
            ->toBase()   // plain rows: skips the model's date casts, so received_at stays "YYYY-MM-DD HH:MM:SS"
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return Inertia::render('field/complaints', [
            'complaints' => $complaints,
            'filters'    => ['q' => $q, 'status_id' => $statusId > 0 ? (string) $statusId : '', 'from' => $from, 'to' => $to],
            'options'    => [
                'statuses'   => DB::table('complaint_statuses')->orderBy('sort_order')->get(['status_id', 'status_name']),
                'categories' => DB::table('complaint_categories')->where('is_active', 1)->orderBy('category_name')->get(['category_id', 'category_name']),
                'provinces'  => DB::table('provinces')->where('is_active', 1)->orderBy('province_name')->get(['province_id', 'province_name']),
            ],
            'office'     => [
                'name'        => $user->office->office_name,
                'province_id' => $user->office->province_id,   // pre-selects the province in the form
            ],
        ]);
    }

    /** POST /field/complaints */
    public function store(StoreFieldComplaintRequest $request, ComplaintWorkflow $workflow): RedirectResponse
    {
        $user = $request->user();

        // The office always comes from the logged-in user, never from the form.
        $result = $workflow->recordFromFieldOffice((int) $user->user_id, (int) $user->office_id, $request->complaintData());

        // Use the id from the workflow if it returns one, otherwise find this user's newest complaint
        $complaintId = (int) ($result['complaint_id'] ?? $result['id'] ?? DB::table('complaints')
            ->where('recorded_by', $user->user_id)
            ->orderByDesc('complaint_id')
            ->value('complaint_id'));

        if ($complaintId) {
            app(ComplaintAdminNotifier::class)->notify($complaintId, 'recorded', (int) $user->user_id, [], $request->ip());
        }

        return redirect()->route('field.complaints')->with('success', $result['message']);
    }
}
