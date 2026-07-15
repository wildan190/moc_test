<?php

use App\Http\Controllers\QueueController;

Route::post('/arrive', [QueueController::class, 'arrive']);
Route::get('/status', [QueueController::class, 'status']);
Route::post('/serve', [QueueController::class, 'serve']);
Route::post('/seat', [QueueController::class, 'seat']);
Route::get('/history', [QueueController::class, 'history']);
