<?php

use App\Http\Controllers\QueueController;

Route::post('/arrive', [QueueController::class, 'arrive']);
Route::get('/status', [QueueController::class, 'status']);
Route::post('/serve', [QueueController::class, 'serve']);
Route::post('/seat', [QueueController::class, 'seat']);
Route::get('/history', [QueueController::class, 'history']);
Route::get('/queue/{id}', [QueueController::class, 'ticket']);
Route::get('/menu', [QueueController::class, 'menu']);
Route::post('/queue/{id}/preorder', [QueueController::class, 'preorder']);
Route::patch('/tables/{id}/status', [QueueController::class, 'updateTableStatus']);
Route::post('/tables/merge', [QueueController::class, 'mergeTables']);
Route::post('/tables/{id}/split', [QueueController::class, 'splitTable']);
Route::post('/tables', [QueueController::class, 'storeTable']);
Route::delete('/tables/{id}', [QueueController::class, 'destroyTable']);
