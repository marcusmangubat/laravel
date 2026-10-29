<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AuditListRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\AuditActions;
use Inertia\Inertia;
use Inertia\Response;

class AuditController extends Controller
{
    private const PER_PAGE = 20;

    public function index(AuditListRequest $request): Response
    {
        $v = $request->validated();

        $q          = trim((string) ($v['q'] ?? ''));
        $from       = $v['from'] ?? null;
        $to         = $v['to'] ?? null;
        $action     = trim((string) ($v['action'] ?? ''));
        $entityType = trim((string) ($v['entity_type'] ?? ''));
        $userId     = (int) ($v['user_id'] ?? 0);
        $page       = max(1, (int) ($v['page'] ?? 1));

        $query = AuditLog::query()
            ->leftJoin('users', 'users.user_id', '=', 'audit_logs.user_id')
            ->leftJoin('complaints', function ($join) {
                $join->on('complaints.complaint_id', '=', 'audit_logs.entity_id')
                     ->where('audit_logs.entity_type', '=', 'complaints');
            })
            ->select([
                'audit_logs.audit_id', 'audit_logs.user_id', 'audit_logs.action',
                'audit_logs.entity_type', 'audit_logs.entity_id', 'audit_logs.new_values',
                'audit_logs.ip_address', 'audit_logs.created_at',
                'users.full_name', 'users.username', 'users.role',
                'complaints.reference_no', 'complaints.title',
            ])
            ->when($q !== '', function ($qb) use ($q) {
                $like = '%' . addcslashes($q, '%_\\') . '%';
                $qb->where(function ($w) use ($like) {
                    $w->where('audit_logs.action', 'like', $like)
                      ->orWhere('audit_logs.entity_type', 'like', $like)
                      ->orWhere('users.full_name', 'like', $like)
                      ->orWhere('users.username', 'like', $like)
                      ->orWhere('complaints.reference_no', 'like', $like)
                      ->orWhereRaw('CAST(audit_logs.entity_id AS CHAR) LIKE ?', [$like]);
                });
            })
            ->when($from, fn ($qb) => $qb->where('audit_logs.created_at', '>=', "$from 00:00:00"))
            ->when($to, fn ($qb) => $qb->where('audit_logs.created_at', '<=', "$to 23:59:59"))
            ->when($action !== '' && isset(AuditActions::LABELS[$action]),
                fn ($qb) => $qb->where('audit_logs.action', $action))
            ->when(in_array($entityType, AuditActions::ENTITY_TYPES, true),
                fn ($qb) => $qb->where('audit_logs.entity_type', $entityType))
            ->when($userId > 0, fn ($qb) => $qb->where('audit_logs.user_id', $userId))
            ->orderByDesc('audit_logs.created_at')
            ->orderByDesc('audit_logs.audit_id');

        $logs = $query->paginate(self::PER_PAGE, ['*'], 'page', $page);

        // Clamp out-of-range pages to the last page (same as the old endpoint).
        if ($logs->lastPage() > 0 && $page > $logs->lastPage()) {
            $logs = $query->paginate(self::PER_PAGE, ['*'], 'page', $logs->lastPage());
        }

        $logs->withQueryString()->through(fn (AuditLog $r) => [
            'audit_id'     => $r->audit_id,
            'action_label' => AuditActions::label((string) $r->action),
            'entity_type'  => $r->entity_type,
            'entity_id'    => $r->entity_id,
            'reference_no' => $r->reference_no,
            'title'        => $r->title,
            'full_name'    => $r->full_name,
            'username'     => $r->username,
            'role'         => $r->role,
            'ip_address'   => $r->ip_address,
            'created_at'   => $r->created_at, // raw "Y-m-d H:i:s" string (Manila time)
            'details'      => $r->detailsText(),
        ]);

        return Inertia::render('admin/audit', [
            'logs'    => $logs,
            'filters' => [
                'q'           => $q,
                'from'        => $from ?? '',
                'to'          => $to ?? '',
                'action'      => $action,
                'entity_type' => $entityType,
                'user_id'     => $userId > 0 ? (string) $userId : '',
            ],
            'actions' => AuditActions::LABELS,
            'users'   => User::orderBy('full_name')->orderBy('username')
                ->get(['user_id', 'full_name', 'username'])
                ->map(fn ($u) => ['id' => $u->user_id, 'name' => $u->full_name ?: $u->username])
                ->values(),
            'today'   => now('Asia/Manila')->toDateString(),
        ]);
    }
}