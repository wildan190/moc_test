<?php

namespace App\Services;

use App\Repositories\Contracts\TableRepositoryInterface;
use App\Repositories\Contracts\QueueRepositoryInterface;
use App\Models\QueueMember;
use App\Models\Table;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RestaurantService
{
    protected TableRepositoryInterface $tableRepository;
    protected QueueRepositoryInterface $queueRepository;
    protected PieSocketService $pieSocketService;

    public function __construct(
        TableRepositoryInterface $tableRepository,
        QueueRepositoryInterface $queueRepository,
        PieSocketService $pieSocketService
    ) {
        $this->tableRepository = $tableRepository;
        $this->queueRepository = $queueRepository;
        $this->pieSocketService = $pieSocketService;
    }

    /**
     * Calculate eating time.
     * Formula: (party_size * 15) + random(5 to 15)
     */
    public function calculateEatingTime(int $partySize): int
    {
        return ($partySize * 15) + rand(5, 15);
    }

    /**
     * Find the best table matching party size.
     * Rules: closest capacity (no oversize).
     */
    public function findBestTable(int $partySize): ?Table
    {
        $vacantTables = $this->tableRepository->getVacantTables();

        // Cari meja yang kapasitasnya cukup, diurutkan dari selisih kapasitas terkecil (paling optimal)
        return $vacantTables
            ->filter(fn ($table) => $table->capacity >= $partySize && $table->status === 'vacant' && !$this->hasUpcomingReservation($table))
            ->sortBy(fn ($table) => $table->capacity - $partySize)
            ->first();
    }

    /**
     * Try to seat a queue member at a table.
     */
    public function seatCustomer(QueueMember $customer, Table $table): Table
    {
        if ($customer->reservation_id) {
            $reservedTableId = DB::table('pos_reservations')
                ->join('pos_reservation_spaces', 'pos_reservations.space_id', '=', 'pos_reservation_spaces.id')
                ->where('pos_reservations.id', $customer->reservation_id)
                ->value('pos_reservation_spaces.table_id');
            if ($reservedTableId && $reservedTableId !== $table->id) {
                throw ValidationException::withMessages(['table_id' => "Reservasi ini terikat pada Meja {$reservedTableId}."]);
            }
        }
        if ($customer->source !== 'reservation' && $this->hasUpcomingReservation($table)) {
            throw ValidationException::withMessages(['table_id' => "Meja {$table->id} sudah dijadwalkan untuk reservasi."]);
        }

        $eatingTime = $this->calculateEatingTime($customer->party_size);

        $customer->status = 'seated';
        $customer->seated_at = Carbon::now();
        $customer->eating_time_minutes = $eatingTime;
        $this->queueRepository->save($customer);
        if ($customer->reservation_id) {
            DB::table('pos_reservations')->where('id', $customer->reservation_id)->update(['status' => 'seated', 'updated_at' => now()]);
        }

        $table->status = 'dining';
        $table->queue_member_id = $customer->id;
        $table->started_at = Carbon::now();
        $table->eating_time_minutes = $eatingTime;
        $this->tableRepository->save($table);

        $this->pieSocketService->broadcast('table_seated', [
            'table_id' => $table->id,
            'customer_name' => $customer->customer_name,
            'party_size' => $customer->party_size,
            'queue_member_id' => $customer->id,
            'eating_time_minutes' => $eatingTime,
        ]);

        return $table;
    }

    /**
     * Seating from active queue if possible.
     */
    public function processWaitingQueue(): void
    {
        $activeQueue = $this->queueRepository->getActiveQueue();
        foreach ($activeQueue as $customer) {
            if ($customer->reservation_id) {
                $reservedTableId = DB::table('pos_reservations')
                    ->join('pos_reservation_spaces', 'pos_reservations.space_id', '=', 'pos_reservation_spaces.id')
                    ->where('pos_reservations.id', $customer->reservation_id)
                    ->value('pos_reservation_spaces.table_id');
                $reservedTable = $reservedTableId ? $this->tableRepository->find($reservedTableId) : null;
                if ($reservedTable && in_array($reservedTable->status, ['vacant', 'reserved'], true) && $reservedTable->capacity >= $customer->party_size) {
                    $this->seatCustomer($customer, $reservedTable);
                } elseif (!$reservedTable) {
                    $fallbackTable = $this->findBestTable($customer->party_size);
                    if ($fallbackTable) $this->seatCustomer($customer, $fallbackTable);
                }
                continue;
            }
            $table = $this->findBestTable($customer->party_size);
            if ($table) {
                $this->seatCustomer($customer, $table);
            }
        }
    }

    /**
     * Release/Serve a table (completed dining).
     */
    public function completeDining(Table $table): void
    {
        $freedTableId = $table->id;
        $customerName = null;
        if ($table->queue_member_id) {
            $customer = $this->queueRepository->find($table->queue_member_id);
            if ($customer) {
                $customerName = $customer->customer_name;
                $customer->status = 'served';
                $customer->completed_at = Carbon::now();
                $this->queueRepository->save($customer);
                if ($customer->reservation_id) {
                    DB::table('pos_reservations')->where('id', $customer->reservation_id)->update(['status' => 'completed', 'updated_at' => now()]);
                }
            }
        }

        $table->status = 'vacant';
        $table->queue_member_id = null;
        $table->started_at = null;
        $table->eating_time_minutes = null;
        $this->tableRepository->save($table);

        $this->pieSocketService->broadcast('table_served', [
            'table_id' => $freedTableId,
            'customer_name' => $customerName,
        ]);

        $this->processWaitingQueue();
    }

    /** Convert due bookings into queue entries and seat them at their reserved physical table. */
    public function processDueReservations(): void
    {
        $now = Carbon::now();
        DB::table('pos_reservations')->where('status', 'confirmed')->whereDate('reservation_date', '<', $now->toDateString())->update(['status' => 'no_show', 'updated_at' => now()]);
        $ids = DB::table('pos_reservations')
            ->where('status', 'confirmed')
            ->whereNull('queue_member_id')
            ->whereDate('reservation_date', $now->toDateString())
            ->where('start_time', '<=', $now->format('H:i:s'))
            ->orderBy('reservation_date')->orderBy('start_time')->limit(50)->pluck('id');

        foreach ($ids as $id) {
            DB::transaction(function () use ($id) {
                $reservation = DB::table('pos_reservations')->where('id', $id)->lockForUpdate()->first();
                if (!$reservation || $reservation->status !== 'confirmed' || $reservation->queue_member_id) return;

                $customer = QueueMember::create([
                    'customer_name' => $reservation->customer_name,
                    'party_size' => $reservation->party_size,
                    'status' => 'waiting',
                    'joined_at' => now(),
                    'source' => 'reservation',
                    'reservation_id' => $reservation->id,
                ]);
                DB::table('pos_reservations')->where('id', $reservation->id)->update([
                    'status' => 'arrived',
                    'queue_member_id' => $customer->id,
                    'arrived_at' => now(),
                    'updated_at' => now(),
                ]);

                $tableId = DB::table('pos_reservation_spaces')->where('id', $reservation->space_id)->value('table_id');
                $table = $tableId ? $this->tableRepository->find($tableId) : null;
                if ($table && in_array($table->status, ['vacant', 'reserved'], true) && $table->capacity >= $customer->party_size) {
                    $this->seatCustomer($customer, $table);
                }
                $this->pieSocketService->broadcast('reservation_arrived', [
                    'reservation_id' => $reservation->id,
                    'queue_member_id' => $customer->id,
                    'customer_name' => $customer->customer_name,
                ]);
            });
        }
    }

    /** Attach today's confirmed and checked-in bookings to their physical floor-plan tables. */
    public function attachUpcomingReservations($tables): void
    {
        $tableIds = collect($tables)->pluck('id')->all();
        if (!$tableIds) return;

        $bookings = DB::table('pos_reservations')
            ->join('pos_reservation_spaces', 'pos_reservations.space_id', '=', 'pos_reservation_spaces.id')
            ->whereIn('pos_reservation_spaces.table_id', $tableIds)
            ->whereDate('pos_reservations.reservation_date', now()->toDateString())
            ->whereIn('pos_reservations.status', ['confirmed', 'arrived'])
            ->where('pos_reservations.start_time', '<=', now()->addMinutes(150)->format('H:i:s'))
            ->where('pos_reservations.end_time', '>', now()->format('H:i:s'))
            ->select('pos_reservations.id', 'pos_reservations.queue_member_id', 'pos_reservations.status', 'pos_reservations.customer_name', 'pos_reservations.party_size', 'pos_reservations.start_time', 'pos_reservations.end_time', 'pos_reservation_spaces.table_id')
            ->orderBy('pos_reservations.start_time')->get()->groupBy('table_id');

        foreach ($tables as $table) {
            $table->setAttribute('reservation', $bookings->get($table->id)?->first());
        }
    }

    public function attachQueueReservationTables($queue): void
    {
        $reservationIds = collect($queue)->pluck('reservation_id')->filter()->all();
        if (!$reservationIds) return;
        $tableIds = DB::table('pos_reservations')
            ->join('pos_reservation_spaces', 'pos_reservations.space_id', '=', 'pos_reservation_spaces.id')
            ->whereIn('pos_reservations.id', $reservationIds)
            ->pluck('pos_reservation_spaces.table_id', 'pos_reservations.id');
        foreach ($queue as $member) {
            if ($member->reservation_id && isset($tableIds[$member->reservation_id])) {
                $member->setAttribute('reservation_table_id', $tableIds[$member->reservation_id]);
            }
        }
    }

    private function hasUpcomingReservation(Table $table): bool
    {
        $until = Carbon::now()->addMinutes(150);
        return DB::table('pos_reservations')
            ->join('pos_reservation_spaces', 'pos_reservations.space_id', '=', 'pos_reservation_spaces.id')
            ->where('pos_reservation_spaces.table_id', $table->id)
            ->whereIn('pos_reservations.status', ['confirmed', 'arrived'])
            ->whereDate('pos_reservations.reservation_date', now()->toDateString())
            ->where('pos_reservations.start_time', '<=', $until->format('H:i:s'))
            ->where('pos_reservations.end_time', '>', now()->format('H:i:s'))
            ->exists();
    }
}
