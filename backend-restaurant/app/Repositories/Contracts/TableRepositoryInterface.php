<?php

namespace App\Repositories\Contracts;

interface TableRepositoryInterface
{
    public function all();
    public function find(string $id);
    public function getVacantTables();
    public function save($table);
}
