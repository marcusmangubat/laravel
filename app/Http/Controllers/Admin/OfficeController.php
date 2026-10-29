<?php
// app/Http/Controllers/Admin/OfficeController.php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OfficeController extends Controller
{
    private const PER_PAGE = 15;

    private const OFFICE_TYPES = [
        'regional' => 'Regional Office',
        'penro'    => 'PENRO',
        'cenro'    => 'CENRO',
        'division' => 'Division',
        'bureau'   => 'Bureau',
        'other'    => 'Other',
    ];

    /**
     * Replaces: offices.php (page) + ajax/offices_list.php.
     * Admin-only access is handled by the 'admin' route middleware.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        $f = $request->validate([
            'q'           => ['nullable', 'string', 'max:100'],
            'office_type' => ['nullable', Rule::in(array_keys(self::OFFICE_TYPES))],
            'province_id' => ['nullable', 'integer', 'exists:provinces,province_id'],
            'is_active'   => ['nullable', 'in:0,1'],
            'can_receive' => ['nullable', 'in:0,1'],
            'page'        => ['nullable', 'integer', 'min:1'],
        ]);

        $offices = DB::table('offices as o')
            ->leftJoin('provinces as p', 'p.province_id', '=', 'o.province_id')
            ->leftJoin('offices as parent', 'parent.office_id', '=', 'o.parent_office_id')

            ->when($f['q'] ?? null, function ($query, $term) {
                $like = '%' . addcslashes($term, '%_\\') . '%';
                $query->where(fn ($w) => $w
                    ->where('o.office_name', 'like', $like)
                    ->orWhere('o.office_code', 'like', $like)
                    ->orWhere('o.address', 'like', $like)
                    ->orWhere('o.email', 'like', $like)
                    ->orWhere('p.province_name', 'like', $like)
                    ->orWhere('parent.office_name', 'like', $like));
            })
            ->when($f['office_type'] ?? null, fn ($q, $v) => $q->where('o.office_type', $v))
            ->when($f['province_id'] ?? null, fn ($q, $v) => $q->where('o.province_id', $v))

            // NOTE: ->when('0', ...) would be SKIPPED, because "0" counts as false in PHP.
            // But "0" is a real choice here ("Inactive" / "Cannot receive"), so compare with null.
            ->when(($f['is_active'] ?? null) !== null,   fn ($q) => $q->where('o.is_active', (int) $f['is_active']))
            ->when(($f['can_receive'] ?? null) !== null, fn ($q) => $q->where('o.can_receive_assignments', (int) $f['can_receive']))

            // Same order as before: type, then province (unknown last), then name
            ->orderByRaw("FIELD(o.office_type, 'regional', 'penro', 'cenro', 'division', 'bureau', 'other')")
            ->orderByRaw('p.province_name IS NULL')
            ->orderBy('p.province_name')
            ->orderBy('o.office_name')

            ->select([
                'o.office_id', 'o.office_code', 'o.office_name', 'o.office_type', 'o.address',
                'o.contact_number', 'o.email', 'o.can_receive_assignments', 'o.is_active', 'o.remarks',
                'p.province_name',
                'parent.office_name as parent_name',
                DB::raw("(SELECT COUNT(*) FROM users u
                          WHERE u.office_id = o.office_id AND u.role = 'field_office') AS account_count"),
                DB::raw("(SELECT COUNT(*) FROM complaints c
                          WHERE c.current_office_id = o.office_id AND c.deleted_at IS NULL) AS complaint_count"),
            ])
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            // through() lets you reshape every row after it is loaded
            ->through(function ($r) {
                $r->type_label              = self::OFFICE_TYPES[$r->office_type] ?? $r->office_type;
                $r->account_count           = (int) $r->account_count;
                $r->complaint_count         = (int) $r->complaint_count;
                $r->is_active               = (int) $r->is_active;
                $r->can_receive_assignments = (int) $r->can_receive_assignments;
                return $r;
            });

        // Page number past the end -> go to the last page (like min($page, $pages))
        if ($offices->currentPage() > $offices->lastPage()) {
            return redirect()->route('admin.offices', array_merge(
                $request->query(),
                ['page' => $offices->lastPage()]
            ));
        }

        return Inertia::render('admin/offices', [
            'offices' => $offices,
            'filters' => [
                'q'           => $f['q'] ?? '',
                'office_type' => $f['office_type'] ?? '',
                'province_id' => $f['province_id'] ?? '',
                'is_active'   => $f['is_active'] ?? '',
                'can_receive' => $f['can_receive'] ?? '',
            ],
            'office_types' => self::OFFICE_TYPES,
            'provinces'    => fn () => DB::table('provinces')->where('is_active', 1)
                                        ->orderBy('province_name')->get(['province_id', 'province_name']),
        ]);
    }
}