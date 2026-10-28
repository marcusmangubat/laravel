<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $primaryKey = 'audit_id';
    const UPDATED_AT = null;             // only created_at exists
    protected $guarded = [];

    protected $casts = [
        'old_values' => 'array',         // JSON column becomes a PHP array
        'new_values' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
