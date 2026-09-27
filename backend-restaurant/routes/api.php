<?php

use App\Http\Controllers\QueueController;
use App\Http\Controllers\PosController;

Route::get('/pos/outlets', [PosController::class, 'outlets']);
Route::get('/pos/products', [PosController::class, 'products']);
Route::post('/pos/products', [PosController::class, 'storeProduct']);
Route::patch('/pos/products/{id}', [PosController::class, 'updateProduct']);
Route::post('/pos/checkout', [PosController::class, 'checkout']);
Route::get('/pos/sales', [PosController::class, 'sales']);
Route::get('/pos/customers', [PosController::class, 'customers']);
Route::post('/pos/customers', [PosController::class, 'storeCustomer']);
Route::get('/pos/reservations', [PosController::class, 'reservations']);
Route::get('/pos/spaces', [PosController::class, 'spaces']);
Route::post('/pos/reservations', [PosController::class, 'storeReservation']);

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
