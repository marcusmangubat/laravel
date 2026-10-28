<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    protected $primaryKey = 'user_id';
    protected $guarded = [];
    protected $hidden = ['password_hash'];

    protected $casts = [
        'is_active'            => 'boolean',
        'must_change_password' => 'boolean',
        'last_login_at'        => 'datetime',
        'locked_until'         => 'datetime',
        'password_changed_at'  => 'datetime',
    ];

    // Tells Laravel's login which column holds the hash (default is "password")
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    // Your table has no remember_token column
    public function getRememberTokenName()
    {
        return '';
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id', 'office_id');
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}