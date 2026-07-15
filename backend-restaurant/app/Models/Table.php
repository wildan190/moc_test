<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Table extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'capacity',
        'status',
        'queue_member_id',
        'started_at',
        'eating_time_minutes',
    ];

    protected $casts = [
        'started_at' => 'datetime',
    ];

    public function queueMember(): BelongsTo
    {
        return $this->belongsTo(QueueMember::class, 'queue_member_id');
    }
}
