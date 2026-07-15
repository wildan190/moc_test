<?php

namespace App\Repositories\Contracts;

interface QueueRepositoryInterface
{
    public function find(int $id);
    public function getActiveQueue();
    public function getHistory();
    public function create(array $data);
    public function save($queueMember);
}
