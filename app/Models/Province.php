<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Province extends Model
{
    protected $primaryKey = 'province_id';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = ['is_active' => 'boolean'];

    public function complaints()
    {
        return $this->hasMany(Complaint::class, 'province_id', 'province_id');
    }
}