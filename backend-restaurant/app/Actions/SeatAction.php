<?php

namespace App\Actions;

use App\Http\Requests\SeatRequest;
use App\Repositories\Contracts\TableRepositoryInterface;
use App\Repositories\Contracts\QueueRepositoryInterface;
use App\Services\RestaurantService;
use App\Models\Table;
use Illuminate\Validation\ValidationException;

class SeatAction
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

    public function execute(SeatRequest $request): Table
    {
        $data = $request->validated();
        
        $customer = $this->queueRepository->find($data['queue_member_id']);
        $table = $this->tableRepository->find($data['table_id']);

        if ($table->status === 'dining') {
            throw ValidationException::withMessages([
                'table_id' => ["Table {$data['table_id']} is currently occupied."]
            ]);
        }

        if ($customer->party_size > $table->capacity) {
            throw ValidationException::withMessages([
                'table_id' => ["Table {$data['table_id']} capacity is too small for party size {$customer->party_size}."]
            ]);
        }

        $this->restaurantService->seatCustomer($customer, $table);

        return $this->tableRepository->find($data['table_id']);
    }
}
