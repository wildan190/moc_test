<?php

namespace App\Http\Controllers;

use App\Actions\ArriveAction;
use App\Actions\GetStatusAction;
use App\Actions\ServeAction;
use App\Actions\GetHistoryAction;
use App\Http\Requests\ArriveRequest;
use App\Http\Requests\ServeRequest;
use Illuminate\Http\JsonResponse;

use App\Actions\SeatAction;
use App\Http\Requests\SeatRequest;

class QueueController extends Controller
{
    public function arrive(ArriveRequest $request, ArriveAction $action): JsonResponse
    {
        $customer = $action->execute($request);
        return response()->json([
            'message' => 'Arrival processed successfully',
            'customer' => $customer
        ], 201);
    }

    public function status(GetStatusAction $action): JsonResponse
    {
        $status = $action->execute();
        return response()->json($status);
    }

    public function serve(ServeRequest $request, ServeAction $action): JsonResponse
    {
        $table = $action->execute($request);
        return response()->json([
            'message' => 'Table served/completed successfully',
            'table' => $table
        ]);
    }

    public function seat(SeatRequest $request, SeatAction $action): JsonResponse
    {
        $table = $action->execute($request);
        return response()->json([
            'message' => 'Customer seated successfully',
            'table' => $table
        ]);
    }

    public function history(GetHistoryAction $action): JsonResponse
    {
        $history = $action->execute();
        return response()->json($history);
    }

    public function ticket(int $id): JsonResponse
    {
        $customer = \App\Models\QueueMember::with('table')->find($id);
        if (!$customer) {
            return response()->json(['message' => 'Tiket antrean tidak ditemukan'], 404);
        }

        // Hitung posisi antrean di depan pelanggan jika masih waiting
        $aheadCount = 0;
        if ($customer->status === 'waiting') {
            $aheadCount = \App\Models\QueueMember::where('status', 'waiting')
                ->where('joined_at', '<', $customer->joined_at)
                ->count();
        }

        return response()->json([
            'customer' => $customer,
            'ahead_count' => $aheadCount,
            'estimated_wait_minutes' => max(5, $aheadCount * 12),
        ]);
    }

    /**
     * Katalog menu digital resto untuk Pre-Order
     */
    public function menu(): JsonResponse
    {
        $items = [
            [
                'id' => 1,
                'name' => 'Wagyu Beef Steak Special',
                'category' => 'Main Course',
                'price' => 145000,
                'description' => 'Daging wagyu premium 200g dengan saus mushroom dan kentang tumbuk',
                'image' => '🥩'
            ],
            [
                'id' => 2,
                'name' => 'Grilled Salmon Lemon Butter',
                'category' => 'Main Course',
                'price' => 120000,
                'description' => 'Salmon panggang segar dengan saus mentega lemon dan sayuran panggang',
                'image' => '🐟'
            ],
            [
                'id' => 3,
                'name' => 'Spaghetti Truffle Carbonara',
                'category' => 'Pasta',
                'price' => 85000,
                'description' => 'Pasta creamy italia berpadu aroma minyak truffle dan daging asap renyah',
                'image' => '🍝'
            ],
            [
                'id' => 4,
                'name' => 'Crispy Calamari Rings',
                'category' => 'Appetizer',
                'price' => 45000,
                'description' => 'Cumi goreng tepung keemasan dengan saus tartar homemade',
                'image' => '🦑'
            ],
            [
                'id' => 5,
                'name' => 'Caesar Salad Parmesan',
                'category' => 'Appetizer',
                'price' => 42000,
                'description' => 'Selada romaine segar dengan saus caesar, croutons gurih dan taburan parmesan',
                'image' => '🥗'
            ],
            [
                'id' => 6,
                'name' => 'Iced Peach Sparkling Tea',
                'category' => 'Beverage',
                'price' => 28000,
                'description' => 'Teh persik bersoda segar dengan potongan buah asli dan daun mint',
                'image' => '🍹'
            ],
            [
                'id' => 7,
                'name' => 'Classic Matcha Latte',
                'category' => 'Beverage',
                'price' => 32000,
                'description' => 'Matcha jepang autentik dengan susu segar lembut',
                'image' => '🍵'
            ],
            [
                'id' => 8,
                'name' => 'Molten Lava Cake Gelato',
                'category' => 'Dessert',
                'price' => 38000,
                'description' => 'Kue cokelat hangat meleleh di bagian dalam dengan gelato vanila madagascar',
                'image' => '🍫'
            ],
        ];

        return response()->json($items);
    }

    /**
     * Simpan pre-order makanan dari pelanggan antrean
     */
    public function preorder(int $id, \Illuminate\Http\Request $request, \App\Services\PieSocketService $pieSocket): JsonResponse
    {
        $customer = \App\Models\QueueMember::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Pelanggan tidak ditemukan'], 404);
        }

        $validated = $request->validate([
            'items' => 'required|array',
            'notes' => 'nullable|string',
        ]);

        $customer->pre_orders = [
            'items' => $validated['items'],
            'notes' => $validated['notes'] ?? '',
            'updated_at' => now()->toIso8601String(),
        ];
        $customer->save();

        $pieSocket->broadcast('preorder_updated', [
            'queue_member_id' => $customer->id,
            'customer_name' => $customer->customer_name,
            'items_count' => count($validated['items']),
        ]);

        return response()->json([
            'message' => 'Pre-order berhasil disimpan!',
            'customer' => $customer
        ]);
    }

    /**
     * Update status meja granular (needs_cleaning, vacant, bill_requested, reserved)
     */
    public function updateTableStatus(string $id, \Illuminate\Http\Request $request, \App\Services\RestaurantService $restaurantService, \App\Services\PieSocketService $pieSocket): JsonResponse
    {
        $table = \App\Models\Table::find($id);
        if (!$table) {
            return response()->json(['message' => 'Meja tidak ditemukan'], 404);
        }

        $validated = $request->validate([
            'status' => 'required|in:vacant,dining,needs_cleaning,bill_requested,reserved',
        ]);

        $newStatus = $validated['status'];
        $table->status = $newStatus;

        // Jika selesai dibersihkan (menjadi vacant), proses antrean yang menunggu
        if ($newStatus === 'vacant') {
            $table->queue_member_id = null;
            $table->started_at = null;
            $table->eating_time_minutes = null;
            $table->save();
            $restaurantService->processWaitingQueue();
        } else {
            $table->save();
        }

        $pieSocket->broadcast('table_status_changed', [
            'table_id' => $table->id,
            'status' => $table->status,
        ]);

        return response()->json([
            'message' => "Status Meja {$id} berhasil diperbarui menjadi {$newStatus}",
            'table' => $table
        ]);
    }

    /**
     * Menggabungkan 2 meja (Table Merging)
     */
    public function mergeTables(\Illuminate\Http\Request $request, \App\Services\PieSocketService $pieSocket): JsonResponse
    {
        $validated = $request->validate([
            'primary_table_id' => 'required|string',
            'secondary_table_id' => 'required|string',
        ]);

        $primary = \App\Models\Table::find($validated['primary_table_id']);
        $secondary = \App\Models\Table::find($validated['secondary_table_id']);

        if (!$primary || !$secondary) {
            return response()->json(['message' => 'Meja tidak ditemukan'], 404);
        }

        if ($primary->status !== 'vacant' || $secondary->status !== 'vacant') {
            return response()->json(['message' => 'Kedua meja harus dalam kondisi kosong (vacant) untuk digabung.'], 422);
        }

        $primary->capacity += $secondary->capacity;
        $primary->merged_with = $secondary->id;
        $primary->save();

        $secondary->status = 'reserved';
        $secondary->merged_with = $primary->id;
        $secondary->save();

        $pieSocket->broadcast('table_merged', [
            'primary_table_id' => $primary->id,
            'secondary_table_id' => $secondary->id,
            'new_capacity' => $primary->capacity,
        ]);

        return response()->json([
            'message' => "Meja {$primary->id} dan Meja {$secondary->id} berhasil digabungkan (Total Kapasitas: {$primary->capacity})",
            'primary' => $primary,
            'secondary' => $secondary,
        ]);
    }

    /**
     * Memisahkan meja yang sebelumnya digabung (Table Split)
     */
    public function splitTable(string $id, \Illuminate\Http\Request $request, \App\Services\PieSocketService $pieSocket): JsonResponse
    {
        $table = \App\Models\Table::find($id);
        if (!$table || !$table->merged_with) {
            return response()->json(['message' => 'Meja ini tidak sedang digabungkan.'], 422);
        }

        $partner = \App\Models\Table::find($table->merged_with);

        // Reset data awal tabel sesuai seed default
        $defaults = [
            'A' => 2,
            'B' => 4,
            'C' => 6,
            'D' => 8,
        ];

        $table->capacity = $defaults[$table->id] ?? 4;
        $table->merged_with = null;
        $table->status = 'vacant';
        $table->save();

        if ($partner) {
            $partner->capacity = $defaults[$partner->id] ?? 4;
            $partner->merged_with = null;
            $partner->status = 'vacant';
            $partner->save();
        }

        $pieSocket->broadcast('table_split', [
            'table_id' => $table->id,
        ]);

        return response()->json([
            'message' => "Meja {$id} dan pasangannya telah berhasil dipisahkan kembali.",
        ]);
    }

    /**
     * Tambah meja baru (Create Table)
     */
    public function storeTable(\Illuminate\Http\Request $request, \App\Services\RestaurantService $restaurantService, \App\Services\PieSocketService $pieSocket): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:10|unique:tables,id',
            'capacity' => 'required|integer|min:1|max:20',
        ]);

        $table = \App\Models\Table::create([
            'id' => strtoupper(trim($validated['id'])),
            'capacity' => (int) $validated['capacity'],
            'status' => 'vacant',
            'queue_member_id' => null,
            'started_at' => null,
            'eating_time_minutes' => null,
        ]);

        // Cek apakah ada antrean yang cocok dengan meja baru ini
        $restaurantService->processWaitingQueue();

        $pieSocket->broadcast('table_created', [
            'table_id' => $table->id,
            'capacity' => $table->capacity,
        ]);

        return response()->json([
            'message' => "Meja {$table->id} (Kapasitas: {$table->capacity} org) berhasil ditambahkan!",
            'table' => $table,
        ], 201);
    }

    /**
     * Hapus meja (Delete Table)
     */
    public function destroyTable(string $id, \App\Services\PieSocketService $pieSocket): JsonResponse
    {
        $table = \App\Models\Table::find($id);
        if (!$table) {
            return response()->json(['message' => 'Meja tidak ditemukan'], 404);
        }

        if ($table->status === 'dining') {
            return response()->json(['message' => 'Meja sedang digunakan oleh tamu dan tidak dapat dihapus.'], 422);
        }

        $table->delete();

        $pieSocket->broadcast('table_deleted', [
            'table_id' => $id,
        ]);

        return response()->json([
            'message' => "Meja {$id} berhasil dihapus.",
        ]);
    }
}
