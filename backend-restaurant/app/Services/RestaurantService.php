<?php

namespace App\Services;

use App\Repositories\Contracts\TableRepositoryInterface;
use App\Repositories\Contracts\QueueRepositoryInterface;
use App\Models\QueueMember;
use App\Models\Table;
use Carbon\Carbon;

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
            ->filter(fn ($table) => $table->capacity >= $partySize && $table->status === 'vacant')
            ->sortBy(fn ($table) => $table->capacity - $partySize)
            ->first();
    }

    /**
     * Try to seat a queue member at a table.
     */
    public function seatCustomer(QueueMember $customer, Table $table): Table
    {
        $eatingTime = $this->calculateEatingTime($customer->party_size);

        $customer->status = 'seated';
        $customer->seated_at = Carbon::now();
        $customer->eating_time_minutes = $eatingTime;
        $this->queueRepository->save($customer);

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
}
