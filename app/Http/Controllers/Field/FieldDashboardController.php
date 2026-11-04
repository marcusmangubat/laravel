<?php
// app/Http/Controllers/Field/FieldDashboardController.php

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class FieldDashboardController extends Controller
{
    /**
     * Replaces: field/dashboard.php (page) + field/ajax/dashboard_data.php (GET).
     * The 'field' middleware already checked role, active account and active office.
     */
    public function index(Request $request): Response
    {
        $f = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'to'   => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:from'],
        ]);

        // The office comes from the logged-in user's database row, never from the request.
        $officeId = (int) $request->user()->office_id;
        $userId   = $request->user()->user_id;

        // Closures: skipped on partial reloads that don't ask for them (auto-refresh stays cheap).
        return Inertia::render('field/dashboard', [
            'filters'   => fn () => ['from' => $f['from'] ?? '', 'to' => $f['to'] ?? ''],
            'generated' => fn () => now()->format('M j, Y g:i A'),

            'cards' => fn () => $this->cards($officeId, $f),

            'by_status' => fn () => $this->scoped($officeId, $f)
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->groupBy('s.status_id', 's.status_name', 's.sort_order')
                ->orderBy('s.sort_order')
                ->get(['s.status_name as label', DB::raw('COUNT(*) as total')]),

            'by_category' => fn () => $this->scoped($officeId, $f)
                ->leftJoin('complaint_categories as cc', 'cc.category_id', '=', 'c.category_id')
                ->groupBy('label')->orderByDesc('total')->limit(8)
                ->get([DB::raw("COALESCE(cc.category_name, 'Uncategorized') as label"), DB::raw('COUNT(*) as total')]),

            'by_priority' => fn () => $this->scoped($officeId, $f)
                ->groupBy('c.priority')
                ->orderByRaw("FIELD(c.priority, 'urgent', 'high', 'normal', 'low')")
                ->get(['c.priority as label', DB::raw('COUNT(*) as total')]),

            // Trend ignores the date filter (same as your PHP)
            'trend' => fn () => $this->trend($officeId),

            // Complaints needing action: earliest target date first, then by priority
            'needs' => fn () => $this->scoped($officeId)
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->whereIn('s.status_code', ['assigned', 'under_investigation', 'for_info'])
                ->orderByRaw('(c.target_date IS NULL)')
                ->orderBy('c.target_date')
                ->orderByRaw("FIELD(c.priority, 'urgent', 'high', 'normal', 'low')")
                ->limit(8)
                ->get([
                    'c.complaint_id', 'c.reference_no', 'c.title', 'c.priority', 'c.target_date',
                    's.status_code', 's.status_name',
                    DB::raw('(c.target_date IS NOT NULL AND c.target_date < CURDATE()) AS is_overdue'),
                ]),

            // Recent assignments to my office
            'assignments' => fn () => DB::table('complaint_assignments as a')
                ->join('complaints as c', function ($join) {
                    $join->on('c.complaint_id', '=', 'a.complaint_id')->whereNull('c.deleted_at');
                })
                ->where('a.to_office_id', $officeId)
                ->orderByDesc('a.created_at')
                ->limit(6)
                ->get(['a.assignment_type', 'a.is_current', 'a.created_at',
                       'c.complaint_id', 'c.reference_no', 'c.title']),

            // Recent activity on my complaints
            'activity' => fn () => $this->scoped($officeId)
                ->join('complaint_actions as ca', 'ca.complaint_id', '=', 'c.complaint_id')
                ->join('users as u', 'u.user_id', '=', 'ca.user_id')
                ->orderByDesc('ca.action_date')
                ->limit(6)
                ->get(['ca.action_type', 'ca.action_date', 'c.reference_no', 'u.full_name']),

            'unread' => fn () => DB::table('notifications')
                ->where('user_id', $userId)->where('is_read', 0)->count(),
        ]);
    }

    /** Replaces the POST action "mark_notifications_read". CSRF is automatic. */
    public function markNotificationsRead(Request $request): RedirectResponse
    {
        DB::table('notifications')
            ->where('user_id', $request->user()->user_id)
            ->where('is_read', 0)
            ->update(['is_read' => 1]);

        return back();
    }

    // ───────────────────────── helpers ─────────────────────────

    /**
     * The "scope": complaints whose primary office is mine, OR where my office
     * has a current assignment. Optional received_at date range.
     * Always call it fresh; it returns a new query each time.
     */
    private function scoped(int $officeId, array $f = [])
    {
        return DB::table('complaints as c')
            ->whereNull('c.deleted_at')
            // Grouped in one ( ... ) so the OR can't leak into the other conditions
            ->where(function ($q) use ($officeId) {
                $q->where('c.current_office_id', $officeId)
                  ->orWhereExists(function ($sub) use ($officeId) {
                      $sub->select(DB::raw(1))
                          ->from('complaint_assignments as ax')
                          ->whereColumn('ax.complaint_id', 'c.complaint_id')
                          ->where('ax.to_office_id', $officeId)
                          ->where('ax.is_current', 1);
                  });
            })
            ->when($f['from'] ?? null, fn ($q, $d) => $q->where('c.received_at', '>=', $d . ' 00:00:00'))
            ->when($f['to'] ?? null,   fn ($q, $d) => $q->where('c.received_at', '<=', $d . ' 23:59:59'));
    }

    private function cards(int $officeId, array $f): array
    {
        $row = $this->scoped($officeId, $f)
            ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
            ->selectRaw("
                COUNT(*) AS total,
                COALESCE(SUM(s.status_code = 'assigned'), 0) AS newly_assigned,
                COALESCE(SUM(s.status_code = 'under_investigation'), 0) AS under_investigation,
                COALESCE(SUM(s.status_code IN ('assigned','for_info')), 0) AS awaiting_action,
                COALESCE(SUM(s.status_code = 'for_rdac_review'), 0) AS submitted,
                COALESCE(SUM(s.status_code IN ('resolved','closed')), 0) AS completed,
                COALESCE(SUM(c.target_date IS NOT NULL AND c.target_date < CURDATE()
                             AND s.status_code NOT IN ('resolved','closed')), 0) AS overdue,
                COALESCE(SUM(c.target_date BETWEEN CURDATE() AND (CURDATE() + INTERVAL 7 DAY)
                             AND s.status_code NOT IN ('resolved','closed')), 0) AS due_soon
            ")
            ->first();

        return array_map('intval', (array) $row);
    }

    private function trend(int $officeId): array
    {
        $start = now()->subMonthsNoOverflow(11)->startOfMonth();

        $counts = $this->scoped($officeId)
            ->where('c.received_at', '>=', $start)
            ->groupBy('ym')
            ->select([DB::raw("DATE_FORMAT(c.received_at, '%Y-%m') as ym"), DB::raw('COUNT(*) as total')])
            ->get()
            ->pluck('total', 'ym');

        // Fill months with zero complaints so the chart always has 12 bars
        return collect(range(0, 11))->map(function ($i) use ($start, $counts) {
            $m = $start->copy()->addMonthsNoOverflow($i);
            return ['label' => $m->format('M Y'), 'total' => (int) ($counts[$m->format('Y-m')] ?? 0)];
        })->all();
    }
}