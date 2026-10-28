<?php
// app/Http/Controllers/Admin/DashboardController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Replaces: admin/dashboard.php (page) + admin/ajax/dashboard_data.php (GET).
     * Session check, admin role, timeout and CSRF are handled by middleware,
     * so none of that code lives here anymore.
     */
    public function index(Request $request): Response
    {
        // Replaces your hand-written date checks and the 422 responses.
        $f = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'to'   => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:from'],
        ]);

        $userId = $request->user()->user_id;

        // Every prop is a closure. On a normal page load Inertia runs all of them.
        // On router.reload({ only: ['cards'] }) it runs ONLY the ones requested,
        // so the 60-second auto-refresh doesn't re-run every query.
        return Inertia::render('admin/dashboard', [
            'filters'   => fn () => ['from' => $f['from'] ?? '', 'to' => $f['to'] ?? ''],
            'generated' => fn () => now()->format('M j, Y g:i A'),

            'cards' => fn () => $this->cards($f),

            'by_status' => fn () => DB::table('complaint_statuses as s')
                ->leftJoin('complaints as c', function ($join) use ($f) {
                    $join->on('c.status_id', '=', 's.status_id')->whereNull('c.deleted_at');
                    if (!empty($f['from'])) $join->where('c.received_at', '>=', $f['from'] . ' 00:00:00');
                    if (!empty($f['to']))   $join->where('c.received_at', '<=', $f['to'] . ' 23:59:59');
                })
                ->groupBy('s.status_id', 's.status_name', 's.sort_order')
                ->orderBy('s.sort_order')
                ->get(['s.status_name as label', DB::raw('COUNT(c.complaint_id) as total')]),

            'by_province' => fn () => $this->filtered($f)
                ->leftJoin('provinces as p', 'p.province_id', '=', 'c.province_id')
                ->groupBy('label')->orderByDesc('total')
                ->get([DB::raw("COALESCE(p.province_name, 'Unknown') as label"), DB::raw('COUNT(*) as total')]),

            'by_category' => fn () => $this->filtered($f)
                ->leftJoin('complaint_categories as cc', 'cc.category_id', '=', 'c.category_id')
                ->groupBy('label')->orderByDesc('total')->limit(8)
                ->get([DB::raw("COALESCE(cc.category_name, 'Uncategorized') as label"), DB::raw('COUNT(*) as total')]),

            'by_office' => fn () => $this->filtered($f)
                ->leftJoin('offices as o', 'o.office_id', '=', 'c.current_office_id')
                ->groupBy('label')->orderByDesc('total')->limit(8)
                ->get([DB::raw("COALESCE(o.office_name, 'Not yet assigned') as label"), DB::raw('COUNT(*) as total')]),

            // Trend ignores the date filter, same as your PHP.
            'trend' => fn () => $this->trend(),

            'recent' => fn () => $this->filtered($f)
                ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
                ->leftJoin('offices as o', 'o.office_id', '=', 'c.current_office_id')
                ->orderByDesc('c.updated_at')->limit(8)
                ->get([
                    'c.complaint_id', 'c.reference_no', 'c.title', 'c.priority', 'c.updated_at',
                    's.status_code', 's.status_name',
                    DB::raw("COALESCE(o.office_name, 'Not yet assigned') as office_name"),
                ]),

            'activity' => fn () => DB::table('audit_logs as a')
                ->leftJoin('users as u', 'u.user_id', '=', 'a.user_id')
                ->where('a.action', 'not like', 'login%')
                ->orderByDesc('a.created_at')->limit(8)
                ->get(['a.action', 'a.entity_type', 'a.entity_id', 'a.created_at', 'u.full_name']),

            'accounts' => fn () => [
                'total'  => DB::table('users')->where('role', 'field_office')->count(),
                'active' => DB::table('users')->where('role', 'field_office')->where('is_active', 1)->count(),
            ],

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

    /** Base query: not deleted + optional received_at range. Call it fresh each time. */
    private function filtered(array $f)
    {
        return DB::table('complaints as c')
            ->whereNull('c.deleted_at')
            ->when($f['from'] ?? null, fn ($q, $d) => $q->where('c.received_at', '>=', $d . ' 00:00:00'))
            ->when($f['to'] ?? null,   fn ($q, $d) => $q->where('c.received_at', '<=', $d . ' 23:59:59'));
    }

    private function cards(array $f): array
    {
        $row = $this->filtered($f)
            ->join('complaint_statuses as s', 's.status_id', '=', 'c.status_id')
            ->selectRaw("
                COUNT(*) AS total,
                COALESCE(SUM(c.received_at >= (NOW() - INTERVAL 7 DAY)), 0) AS new_recorded,
                COALESCE(SUM(s.status_code IN ('recorded','for_review','for_assignment')), 0) AS awaiting_assignment,
                COALESCE(SUM(s.status_code = 'under_investigation'), 0) AS under_investigation,
                COALESCE(SUM(s.status_code = 'for_info'), 0) AS awaiting_info,
                COALESCE(SUM(s.status_code = 'for_rdac_review'), 0) AS for_review,
                COALESCE(SUM(s.status_code IN ('resolved','closed')), 0) AS resolved_closed,
                COALESCE(SUM(c.target_date IS NOT NULL AND c.target_date < CURDATE()
                             AND s.status_code NOT IN ('resolved','closed')), 0) AS overdue
            ")
            ->first();

        return array_map('intval', (array) $row);
    }

    private function trend(): array
    {
        $start = now()->subMonthsNoOverflow(11)->startOfMonth();

        $counts = DB::table('complaints')
            ->whereNull('deleted_at')
            ->where('received_at', '>=', $start)
            ->groupBy('ym')
            ->pluck(DB::raw('COUNT(*)'), DB::raw("DATE_FORMAT(received_at, '%Y-%m') as ym"));

        // Fill months that have zero complaints so the chart always has 12 bars.
        return collect(range(0, 11))->map(function ($i) use ($start, $counts) {
            $m = $start->copy()->addMonthsNoOverflow($i);
            return ['label' => $m->format('M Y'), 'total' => (int) ($counts[$m->format('Y-m')] ?? 0)];
        })->all();
    }
}