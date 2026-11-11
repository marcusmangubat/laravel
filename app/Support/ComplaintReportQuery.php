<?php

namespace App\Support;

use App\Models\Complaint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ComplaintReportQuery
{
    /** Overdue = target date in the past and not resolved/closed. Adjust to match report_lib.php. */
    public const OVERDUE_SQL =
        "(complaints.target_date IS NOT NULL AND complaints.target_date < ? AND s.status_code NOT IN ('resolved','closed'))";

    /** Pass $officeId for a field office; leave null for the admin (all complaints). */
    public static function build(Request $r, ?int $officeId = null)
    {
        $today = now('Asia/Manila')->toDateString();

        $q = Complaint::query()
            ->whereNull('complaints.deleted_at')
            ->join('complaint_statuses as s', 's.status_id', '=', 'complaints.status_id')
            ->leftJoin('complaint_categories as cat', 'cat.category_id', '=', 'complaints.category_id')
            ->leftJoin('provinces as p', 'p.province_id', '=', 'complaints.province_id')
            ->leftJoin('offices as o', 'o.office_id', '=', 'complaints.current_office_id')
            ->select([
                'complaints.complaint_id', 'complaints.reference_no', 'complaints.title',
                'complaints.barangay', 'complaints.municipality', 'complaints.priority',
                'complaints.received_at', 'complaints.target_date',
                's.status_code', 's.status_name',
                'cat.category_name', 'p.province_name', 'o.office_name',
            ])
            ->selectRaw(self::OVERDUE_SQL . ' AS is_overdue', [$today])
            ->orderByDesc('complaints.received_at')
            ->orderByDesc('complaints.complaint_id');

        if ($officeId !== null) {
            $q->visibleToOffice($officeId);
        }

        if ($search = trim((string) $r->input('q'))) {
            $like = '%' . addcslashes($search, '%_\\') . '%';
            $q->where(function ($w) use ($like) {
                $w->where('complaints.reference_no', 'like', $like)
                  ->orWhere('complaints.title', 'like', $like)
                  ->orWhere('complaints.municipality', 'like', $like)
                  ->orWhere('complaints.barangay', 'like', $like)
                  ->orWhere('complaints.specific_location', 'like', $like);
            });
        }

        $q->when($r->filled('from'), fn ($x) => $x->where('complaints.received_at', '>=', $r->from . ' 00:00:00'))
          ->when($r->filled('to'), fn ($x) => $x->where('complaints.received_at', '<=', $r->to . ' 23:59:59'))
          ->when($r->filled('status_id'), fn ($x) => $x->where('complaints.status_id', $r->status_id))
          ->when($r->filled('category_id'), fn ($x) => $x->where('complaints.category_id', $r->category_id))
          ->when($r->filled('priority'), fn ($x) => $x->where('complaints.priority', $r->priority))
          ->when($r->input('overdue') === '1', fn ($x) => $x->whereRaw(self::OVERDUE_SQL, [$today]));

        // Province and office filters exist for the admin only
        if ($officeId === null) {
            $q->when($r->filled('province_id'), fn ($x) => $x->where('complaints.province_id', $r->province_id))
              ->when($r->office_id === 'none', fn ($x) => $x->whereNull('complaints.current_office_id'))
              ->when($r->filled('office_id') && $r->office_id !== 'none', fn ($x) => $x->where('complaints.current_office_id', $r->office_id));
        }

        return $q;
    }

    /** Human-readable filter list for the audit log and the workbook's Filters sheet. */
    public static function labels(Request $r, bool $admin): array
    {
        $name = fn (string $table, string $key, string $col, $id) =>
            DB::table($table)->where($key, $id)->value($col) ?? $id;

        $labels = [];
        if ($r->filled('q'))           $labels[] = 'Search: ' . $r->q;
        if ($r->filled('from'))        $labels[] = 'Received from ' . $r->from;
        if ($r->filled('to'))          $labels[] = 'Received to ' . $r->to;
        if ($r->filled('status_id'))   $labels[] = 'Status: ' . $name('complaint_statuses', 'status_id', 'status_name', $r->status_id);
        if ($r->filled('category_id')) $labels[] = 'Category: ' . $name('complaint_categories', 'category_id', 'category_name', $r->category_id);
        if ($admin) {
            if ($r->filled('province_id')) $labels[] = 'Province: ' . $name('provinces', 'province_id', 'province_name', $r->province_id);
            if ($r->office_id === 'none')  $labels[] = 'Office: Not yet assigned';
            elseif ($r->filled('office_id')) $labels[] = 'Office: ' . $name('offices', 'office_id', 'office_name', $r->office_id);
        }
        if ($r->filled('priority'))    $labels[] = 'Priority: ' . ucfirst($r->priority);
        if ($r->input('overdue') === '1') $labels[] = 'Overdue only';

        return $labels ?: ['No filters (all matching records)'];
    }
}