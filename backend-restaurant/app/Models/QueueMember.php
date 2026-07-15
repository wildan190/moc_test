<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class QueueMember extends Model
{
    protected $fillable = [
        'customer_name',
        'party_size',
        'status',
        'joined_at',
        'seated_at',
        'completed_at',
        'eating_time_minutes',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'seated_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function table(): HasOne
    {
        return $this->hasOne(Table::class, 'queue_member_id');
    }
}
