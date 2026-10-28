<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Office extends Model
{
    protected $primaryKey = 'office_id';
    protected $guarded = [];

    protected $casts = [
        'can_receive_assignments' => 'boolean',
        'is_active'               => 'boolean',
        'is_verified'             => 'boolean',
    ];

    public function parent()    { return $this->belongsTo(Office::class, 'parent_office_id', 'office_id'); }
    public function children()  { return $this->hasMany(Office::class, 'parent_office_id', 'office_id'); }
    public function province()  { return $this->belongsTo(Province::class, 'province_id', 'province_id'); }
    public function users()     { return $this->hasMany(User::class, 'office_id', 'office_id'); }
    public function complaints(){ return $this->hasMany(Complaint::class, 'current_office_id', 'office_id'); }
}