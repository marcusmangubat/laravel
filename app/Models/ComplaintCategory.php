<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ComplaintCategory extends Model
{
    protected $primaryKey = 'category_id';
    protected $guarded = [];

    protected $casts = ['is_active' => 'boolean'];

    public function complaints()
    {
        return $this->hasMany(Complaint::class, 'category_id', 'category_id');
    }
}
