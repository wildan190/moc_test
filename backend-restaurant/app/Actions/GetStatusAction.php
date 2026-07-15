<?php

namespace App\Actions;

use App\Repositories\Contracts\TableRepositoryInterface;
use App\Repositories\Contracts\QueueRepositoryInterface;

class GetStatusAction
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

    public function execute(): array
    {
        return [
            'tables' => $this->tableRepository->all(),
            'queue' => $this->queueRepository->getActiveQueue(),
        ];
    }
}
