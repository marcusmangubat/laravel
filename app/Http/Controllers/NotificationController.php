<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function readAll(Request $request)
    {
        DB::table('notifications')
            ->where('user_id', (int) $request->user()->user_id)
            ->where('is_read', 0)
            ->update(['is_read' => 1, 'read_at' => now()]);

        return back();
    }

    public function open(Request $request, int $id)
    {
        $user = $request->user();

        $n = DB::table('notifications')
            ->where('notification_id', $id)
            ->where('user_id', (int) $user->user_id)
            ->first();
        abort_if(! $n, 404);

        DB::table('notifications')->where('notification_id', $id)
            ->update(['is_read' => 1, 'read_at' => now()]);

        if (! $n->complaint_id) {
            return back();
        }

        $base = $user->role === 'admin' ? '/admin/complaints/' : '/field/complaints/';
        return redirect($base . $n->complaint_id);
    }
}