<?php

namespace App\Actions;

use App\Http\Requests\ArriveRequest;
use App\Repositories\Contracts\QueueRepositoryInterface;
use App\Services\RestaurantService;
use App\Services\PieSocketService;
use App\Models\QueueMember;

class ArriveAction
{
    protected QueueRepositoryInterface $queueRepository;
    protected RestaurantService $restaurantService;
    protected PieSocketService $pieSocketService;

    public function __construct(
        QueueRepositoryInterface $queueRepository,
        RestaurantService $restaurantService,
        PieSocketService $pieSocketService
    ) {
        $this->queueRepository = $queueRepository;
        $this->restaurantService = $restaurantService;
        $this->pieSocketService = $pieSocketService;
    }

    public function execute(ArriveRequest $request): QueueMember
    {
        $data = $request->validated();

        $customer = $this->queueRepository->create([
            'customer_name' => $data['customer_name'],
            'party_size' => $data['party_size'],
            'status' => 'waiting',
        ]);

        $this->restaurantService->processWaitingQueue();

        $updatedCustomer = $this->queueRepository->find($customer->id);

        $this->pieSocketService->broadcast('queue_arrived', [
            'id' => $updatedCustomer->id,
            'customer_name' => $updatedCustomer->customer_name,
            'party_size' => $updatedCustomer->party_size,
            'status' => $updatedCustomer->status,
        ]);

        return $updatedCustomer;
    }
}
