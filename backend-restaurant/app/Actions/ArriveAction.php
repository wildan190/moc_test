<?php

namespace App\Actions;

use App\Http\Requests\ArriveRequest;
use App\Repositories\Contracts\QueueRepositoryInterface;
use App\Services\RestaurantService;
use App\Models\QueueMember;

class ArriveAction
{
    protected QueueRepositoryInterface $queueRepository;
    protected RestaurantService $restaurantService;

    public function __construct(
        QueueRepositoryInterface $queueRepository,
        RestaurantService $restaurantService
    ) {
        $this->queueRepository = $queueRepository;
        $this->restaurantService = $restaurantService;
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

        return $this->queueRepository->find($customer->id);
    }
}
