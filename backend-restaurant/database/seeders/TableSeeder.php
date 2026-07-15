<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Table;

class TableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $tables = [
            ['id' => 'A', 'capacity' => 2],
            ['id' => 'B', 'capacity' => 4],
            ['id' => 'C', 'capacity' => 6],
            ['id' => 'D', 'capacity' => 8],
        ];

        foreach ($tables as $t) {
            Table::updateOrCreate(
                ['id' => $t['id']],
                ['capacity' => $t['capacity'], 'status' => 'vacant', 'queue_member_id' => null, 'started_at' => null, 'eating_time_minutes' => null]
            );
        }
    }
}
