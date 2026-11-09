<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

// POST /admin/users  (route name: admin.users.store)
class FieldAccountController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'office_id'      => ['required', 'integer', 'exists:offices,office_id'],
            'username'       => ['required', 'string', 'max:60', 'unique:users,username'],
            'email'          => ['required', 'email', 'max:150', 'unique:users,email'],
            'full_name'      => ['required', 'string', 'max:150'],
            'position_title' => ['nullable', 'string', 'max:120'],
            'contact_number' => ['nullable', 'string', 'max:50'],
            'password'       => ['required', 'string', 'min:8'], // temporary password given to the user
        ]);

        User::create([
            ...collect($data)->except('password')->all(),
            'role'                 => 'field_office',
            'password_hash'        => Hash::make($data['password']),
            'must_change_password' => true,   // forces the Login.tsx change-password flow
            'is_active'            => true,
            'created_by'           => $request->user()->user_id,
        ]);

        return back()->with('success', 'Field office account created.');
    }
}
