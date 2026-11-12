<?php

namespace App\Actions;

use App\Repositories\Contracts\TableRepositoryInterface;
use App\Repositories\Contracts\QueueRepositoryInterface;
use App\Services\RestaurantService;

class GetStatusAction
{
    protected TableRepositoryInterface $tableRepository;
    protected QueueRepositoryInterface $queueRepository;
    protected RestaurantService $restaurantService;

    public function __construct(
        TableRepositoryInterface $tableRepository,
        QueueRepositoryInterface $queueRepository,
        RestaurantService $restaurantService
    ) {
        $this->tableRepository = $tableRepository;
        $this->queueRepository = $queueRepository;
        $this->restaurantService = $restaurantService;
    }

    public function execute(): array
    {
        $this->restaurantService->processDueReservations();
        $tables = $this->tableRepository->all();
        $this->restaurantService->attachUpcomingReservations($tables);
        $queue = $this->queueRepository->getActiveQueue();
        $this->restaurantService->attachQueueReservationTables($queue);
        return [
            'tables' => $tables,
            'queue' => $queue,
        ];
    }
}
