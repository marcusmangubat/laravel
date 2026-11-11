<?php

namespace App\Http\Controllers\Field;

use App\Exports\ComplaintsWorkbook;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReportFilterRequest;
use App\Support\ComplaintReportQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    private const PER_PAGE = 15;

    public function index(Request $request)
    {
        return Inertia::render('field/Reports', [
            'today'      => now('Asia/Manila')->toDateString(),
            'officeName' => $request->user()->office?->office_name ?? 'your office',
            'statuses'   => DB::table('complaint_statuses')->orderBy('sort_order')->get(['status_id as id', 'status_name as name']),
            'categories' => DB::table('complaint_categories')->where('is_active', 1)->orderBy('category_name')->get(['category_id as id', 'category_name as name']),
            'dataUrl'    => route('field.reports.data'),
            'exportUrl'  => route('field.reports.export'),
        ]);
    }

    public function data(ReportFilterRequest $request)
    {
        try {
            $officeId = (int) $request->user()->office_id;
            $page = ComplaintReportQuery::build($request, $officeId)->paginate(self::PER_PAGE);

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
            Log::error('field reports_data: ' . $e->getMessage());
            return response()->json(['ok' => false, 'error' => 'server'], 500);
        }
    }

    public function export(ReportFilterRequest $request)
    {
        try {
            $user       = $request->user();
            $officeId   = (int) $user->office_id;
            $officeName = (string) ($user->office?->office_name ?? 'Field Office');

            $query  = ComplaintReportQuery::build($request, $officeId);
            $total  = (clone $query)->toBase()->getCountForPagination();
            $labels = ComplaintReportQuery::labels($request, false);

            DB::table('audit_logs')->insert([
                'user_id'     => $user->getKey(),
                'action'      => 'report_exported',
                'entity_type' => 'complaints',
                'new_values'  => json_encode([
                    'scope' => 'field_office', 'office_id' => $officeId,
                    'total' => $total, 'exported' => $total, 'filters' => $labels,
                ]),
                'ip_address'  => $request->ip(),
                'user_agent'  => substr((string) $request->userAgent(), 0, 255),
                'created_at'  => now(),
            ]);

            $safe = preg_replace('/[^A-Za-z0-9_-]+/', '-', $officeName) ?: 'Field-Office';
            $file = 'RDAC-' . $safe . '-Report-' . now('Asia/Manila')->format('Ymd-His') . '.xlsx';

            return Excel::download(new ComplaintsWorkbook($query, $labels, $officeName, false), $file);
        } catch (\Throwable $e) {
            Log::error('field reports_export: ' . $e->getMessage());
            return response('The Excel report could not be generated. Please try again.', 500);
        }
    }
}