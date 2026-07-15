<?php

namespace App\Repositories\Eloquent;

use App\Models\Table;
use App\Repositories\Contracts\TableRepositoryInterface;

class TableRepository implements TableRepositoryInterface
{
    public function all()
    {
        return Table::with('queueMember')->orderBy('id', 'asc')->get();
    }

    public function find(string $id)
    {
        return Table::with('queueMember')->find($id);
    }

    public function getVacantTables()
    {
        return Table::where('status', 'vacant')->orderBy('capacity', 'asc')->get();
    }

    public function save($table)
    {
        $table->save();
        return $table;
    }
}
