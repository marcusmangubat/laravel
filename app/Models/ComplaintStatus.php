<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ComplaintStatus extends Model
{
    protected $primaryKey = 'status_id';
    public $timestamps = false;          // this table has no created_at / updated_at
    protected $guarded = [];

    protected $casts = ['is_final' => 'boolean'];

    public function complaints()
    {
        return $this->hasMany(Complaint::class, 'status_id', 'status_id');
    }
}
