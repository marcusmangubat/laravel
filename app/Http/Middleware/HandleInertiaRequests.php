<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user()?->only(
                    'user_id',
                    'username',
                    'full_name',
                    'role',
                    'office_id'
                ),
            ],
            'flash' => [
                'force_reset' => fn () => $request->session()->get('force_reset'),
            ],
            'notifications' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return null;
                }
                $uid = (int) $user->user_id;

                return [
                    'unread' => DB::table('notifications')
                        ->where('user_id', $uid)->where('is_read', 0)->count(),
                    'items' => DB::table('notifications')
                        ->where('user_id', $uid)
                        ->orderByDesc('created_at')->orderByDesc('notification_id')
                        ->limit(10)
                        ->get(['notification_id', 'complaint_id', 'notif_type', 'message', 'is_read', 'created_at'])
                        ->map(fn ($n) => [
                            'id' => (int) $n->notification_id,
                            'complaint_id' => $n->complaint_id ? (int) $n->complaint_id : null,
                            'type' => $n->notif_type,
                            'message' => $n->message,
                            'is_read' => (bool) $n->is_read,
                            'created_at' => $n->created_at,
                        ])->all(),
                ];
            },
        ];
    }
}