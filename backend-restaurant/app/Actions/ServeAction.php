<?php

namespace App\Actions;

use App\Http\Requests\ServeRequest;
use App\Repositories\Contracts\TableRepositoryInterface;
use App\Services\RestaurantService;
use App\Models\Table;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class ServeAction
{
    protected TableRepositoryInterface $tableRepository;
    protected RestaurantService $restaurantService;

    public function __construct(
        TableRepositoryInterface $tableRepository,
        RestaurantService $restaurantService
    ) {
        $this->tableRepository = $tableRepository;
        $this->restaurantService = $restaurantService;
    }

    public function execute(ServeRequest $request): Table
    {
        $data = $request->validated();
        $table = $this->tableRepository->find($data['table_id']);

        if (!$table) {
            throw new ModelNotFoundException("Table {$data['table_id']} not found");
        }

        // Force complete dining
        $this->restaurantService->completeDining($table);

        return $this->tableRepository->find($data['table_id']);
    }
}
