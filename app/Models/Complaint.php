<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Complaint extends Model
{
    protected $primaryKey = 'complaint_id';
    protected $guarded = [];

    protected $casts = [
        'received_at'       => 'datetime',
        'incident_datetime' => 'datetime',
        'resolved_at'       => 'datetime',
        'closed_at'         => 'datetime',
        'target_date'       => 'date',
        'is_anonymous'      => 'boolean',
        'is_outside_region' => 'boolean',
    ];

    public function status()   { return $this->belongsTo(ComplaintStatus::class, 'status_id', 'status_id'); }
    public function category() { return $this->belongsTo(ComplaintCategory::class, 'category_id', 'category_id'); }
    public function province() { return $this->belongsTo(Province::class, 'province_id', 'province_id'); }
    public function office()   { return $this->belongsTo(Office::class, 'current_office_id', 'office_id'); }
    public function recorder() { return $this->belongsTo(User::class, 'recorded_by', 'user_id'); }
}
