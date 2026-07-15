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

    public function __construct(
        TableRepositoryInterface $tableRepository,
        QueueRepositoryInterface $queueRepository
    ) {
        $this->tableRepository = $tableRepository;
        $this->queueRepository = $queueRepository;
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

        return $vacantTables->filter(function ($table) use ($partySize) {
            return $table->capacity >= $partySize;
        })->first();
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
        if ($table->queue_member_id) {
            $customer = $this->queueRepository->find($table->queue_member_id);
            if ($customer) {
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

        $this->processWaitingQueue();
    }
}
