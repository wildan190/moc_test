<?php

namespace App\Repositories\Eloquent;

use App\Models\QueueMember;
use App\Repositories\Contracts\QueueRepositoryInterface;

class QueueRepository implements QueueRepositoryInterface
{
    public function find(int $id)
    {
        return QueueMember::with('table')->find($id);
    }

    public function getActiveQueue()
    {
        return QueueMember::with('table')
            ->where('status', 'waiting')
            ->orderBy('party_size', 'desc')
            ->orderBy('joined_at', 'asc')
            ->get();
    }

    public function getHistory()
    {
        return QueueMember::with('table')
            ->whereIn('status', ['served', 'cancelled'])
            ->orderBy('completed_at', 'desc')
            ->limit(50)
            ->get();
    }

    public function create(array $data)
    {
        return QueueMember::create($data);
    }

    public function save($queueMember)
    {
        $queueMember->save();
        return $queueMember;
    }
}
