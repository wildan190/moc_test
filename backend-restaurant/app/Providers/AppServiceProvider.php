<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            \App\Repositories\Contracts\TableRepositoryInterface::class,
            \App\Repositories\Eloquent\TableRepository::class
        );
        $this->app->bind(
            \App\Repositories\Contracts\QueueRepositoryInterface::class,
            \App\Repositories\Eloquent\QueueRepository::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
