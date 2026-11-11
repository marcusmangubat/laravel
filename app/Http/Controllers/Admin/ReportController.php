<?php

namespace App\Http\Controllers\Admin;

use App\Exports\ComplaintsWorkbook;
use App\Http\Controllers\Controller;
use App\Support\ComplaintReportQuery;
use App\Http\Requests\ReportFilterRequest;
use App\Models\Complaint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    private const PER_PAGE = 15;

    /** Overdue = has a target date in the past and is not resolved/closed. Adjust to match report_lib.php. */

    public function index()
    {
        return Inertia::render('admin/Reports', [
            'today'      => now('Asia/Manila')->toDateString(),
            'statuses'   => DB::table('complaint_statuses')->orderBy('sort_order')->get(['status_id as id', 'status_name as name']),
            'categories' => DB::table('complaint_categories')->where('is_active', 1)->orderBy('category_name')->get(['category_id as id', 'category_name as name']),
            'provinces'  => DB::table('provinces')->where('is_active', 1)->orderBy('province_name')->get(['province_id as id', 'province_name as name']),
            'offices'    => DB::table('offices')->where('is_active', 1)->orderBy('office_name')->get(['office_id as id', 'office_name as name']),
            'dataUrl'    => route('admin.reports.data'),
            'exportUrl'  => route('admin.reports.export'),
        ]);
    }

    public function data(ReportFilterRequest $request)
    {
        try {
            $page = $this->query($request)->paginate(self::PER_PAGE);

            return response()->json([
                'ok'       => true,
                'rows'     => collect($page->items())->map(fn ($r) => array_merge($r->toArray(), [
                                'received_at' => $r->received_at?->format('Y-m-d H:i:s'),
                                'target_date' => $r->target_date?->format('Y-m-d'),
                            ]))->all(),
                'page'     => $page->currentPage(),
                'pages'    => max(1, $page->lastPage()),
                'per_page' => $page->perPage(),
                'total'    => $page->total(),
            ]);
        } catch (\Throwable $e) {
            Log::error('admin reports_data: ' . $e->getMessage());
            return response()->json(['ok' => false, 'error' => 'server'], 500);
        }
    }

    public function export(ReportFilterRequest $request)
    {
        try {
            $query  = $this->query($request);
            $total  = (clone $query)->toBase()->getCountForPagination();
            $labels = $this->filterLabels($request);

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->getKey(),
                'action'      => 'report_exported',
                'entity_type' => 'complaints',
                'new_values'  => json_encode([
                    'scope' => 'admin', 'total' => $total, 'exported' => $total, 'filters' => $labels,
                ]),
                'ip_address'  => $request->ip(),
                'user_agent'  => substr((string) $request->userAgent(), 0, 255),
                'created_at'  => now(),
            ]);

            $file = 'RDAC-Complaints-Report-' . now('Asia/Manila')->format('Ymd-His') . '.xlsx';

            return Excel::download(
                new ComplaintsWorkbook($query, $labels, 'RDAC Administrator – Region IV-A'),
                $file
            );
        } catch (\Throwable $e) {
            Log::error('admin reports_export: ' . $e->getMessage());
            return response('The Excel report could not be generated. Please try again.', 500);
        }
    }

    /** Shared by the table and the export so both always match. */
    private function query(Request $r)
    {
        return ComplaintReportQuery::build($r);
    }

    private function filterLabels(Request $r): array
    {
        return ComplaintReportQuery::labels($r, true);
    }
}