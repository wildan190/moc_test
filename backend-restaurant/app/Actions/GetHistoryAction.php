<?php

namespace App\Actions;

use App\Repositories\Contracts\QueueRepositoryInterface;

class GetHistoryAction
{
    protected QueueRepositoryInterface $queueRepository;

    public function __construct(QueueRepositoryInterface $queueRepository)
    {
        $this->queueRepository = $queueRepository;
    }

    public function execute(): array
    {
        return $this->queueRepository->getHistory()->toArray();
    }
}
