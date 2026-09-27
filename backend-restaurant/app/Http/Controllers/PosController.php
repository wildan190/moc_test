<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PosController extends Controller
{
    public function outlets(): JsonResponse
    {
        return response()->json(DB::table('pos_outlets')->where('active', true)->orderBy('name')->get());
    }

    public function products(Request $request): JsonResponse
    {
        $products = DB::table('pos_products')->where('outlet_id', $request->query('outlet_id', 'outlet-jakarta'))->where('active', true)->orderBy('category')->orderBy('name')->get();
        return response()->json($products->map(fn ($product) => $this->withPhotoUrl($product)));
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $data = $request->validate([
            'outlet_id' => 'required|string|max:64|exists:pos_outlets,id', 'name' => 'required|string|max:160', 'category' => 'required|string|max:80',
            'barcode' => 'nullable|string|max:80', 'price' => 'required|integer|min:0', 'stock' => 'required|integer|min:0',
            'is_bundle' => 'boolean', 'bundle_items' => 'nullable|array', 'bundle_items.*.product_id' => 'required_with:bundle_items|integer', 'bundle_items.*.quantity' => 'required_with:bundle_items|integer|min:1',
            'photo' => 'nullable|image|max:4096',
        ]);
        $photo = $request->file('photo') ? $request->file('photo')->store('pos-menu', 'public') : null;
        unset($data['photo']);
        if ($photo) $data['photo_path'] = $photo;
        if (isset($data['bundle_items']) && is_array($data['bundle_items'])) $data['bundle_items'] = json_encode($data['bundle_items']);
        if (!empty($data['is_bundle'])) {
            $parts = json_decode($data['bundle_items'] ?? '[]', true) ?: [];
            foreach ($parts as $part) {
                $validPart = DB::table('pos_products')->where('id', $part['product_id'])->where('outlet_id', $data['outlet_id'])->where('is_bundle', false)->exists();
                if (!$validPart) throw ValidationException::withMessages(['bundle_items' => 'Paket hanya dapat berisi produk biasa dari outlet yang sama.']);
            }
        }
        $id = DB::table('pos_products')->insertGetId($data + ['active' => true, 'created_at' => now(), 'updated_at' => now()]);
        return response()->json($this->withPhotoUrl(DB::table('pos_products')->find($id)), 201);
    }

    public function updateProduct(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['name' => 'sometimes|string|max:160', 'category' => 'sometimes|string|max:80', 'barcode' => 'nullable|string|max:80', 'price' => 'sometimes|integer|min:0', 'stock' => 'sometimes|integer|min:0', 'active' => 'sometimes|boolean', 'is_bundle' => 'sometimes|boolean', 'bundle_items' => 'sometimes|array', 'bundle_items.*.product_id' => 'required_with:bundle_items|integer', 'bundle_items.*.quantity' => 'required_with:bundle_items|integer|min:1', 'photo' => 'nullable|image|max:4096']);
        if (isset($data['bundle_items']) && is_array($data['bundle_items'])) {
            foreach ($data['bundle_items'] as $part) {
                $validPart = DB::table('pos_products')->where('id', $part['product_id'])->where('outlet_id', DB::table('pos_products')->where('id', $id)->value('outlet_id'))->where('is_bundle', false)->exists();
                if (!$validPart) throw ValidationException::withMessages(['bundle_items' => 'Paket hanya dapat berisi produk biasa dari outlet yang sama.']);
            }
            $data['bundle_items'] = json_encode($data['bundle_items']);
        }
        if ($request->hasFile('photo')) {
            $existing = DB::table('pos_products')->where('id', $id)->value('photo_path');
            if ($existing) Storage::disk('public')->delete($existing);
            $data['photo_path'] = $request->file('photo')->store('pos-menu', 'public');
        }
        unset($data['photo']);
        DB::table('pos_products')->where('id', $id)->update($data + ['updated_at' => now()]);
        $product = DB::table('pos_products')->find($id);
        abort_if(!$product, 404, 'Produk tidak ditemukan.');
        return response()->json($this->withPhotoUrl($product));
    }

    public function checkout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'outlet_id' => 'required|string|max:64|exists:pos_outlets,id', 'payment_method' => 'required|in:tunai,kartu,transfer,qris',
            'customer_id' => 'nullable|integer|exists:pos_customers,id', 'discount' => 'nullable|integer|min:0',
            'items' => 'required|array|min:1', 'items.*.product_id' => 'required|integer|exists:pos_products,id', 'items.*.quantity' => 'required|integer|min:1',
        ]);
        $result = DB::transaction(function () use ($data) {
            $products = DB::table('pos_products')->whereIn('id', collect($data['items'])->pluck('product_id'))->lockForUpdate()->get()->keyBy('id');
            $subtotal = 0;
            $lineItems = [];
            foreach ($data['items'] as $item) {
                $product = $products[$item['product_id']] ?? null;
                if (!$product || !$product->active || $product->outlet_id !== $data['outlet_id']) {
                    throw ValidationException::withMessages(['items' => 'Produk tidak tersedia di outlet ini.']);
                }
                $qty = (int) $item['quantity'];
                if (!$product->is_bundle && $product->stock < $qty) {
                    throw ValidationException::withMessages(['items' => "Stok {$product->name} tidak mencukupi."]);
                }
                $line = (int) $product->price * $qty;
                $subtotal += $line;
                $lineItems[] = ['product' => $product, 'quantity' => $qty, 'line_total' => $line];
            }
            $discount = min((int) ($data['discount'] ?? 0), $subtotal);
            $total = $subtotal - $discount;
            $saleId = DB::table('pos_sales')->insertGetId([
                'outlet_id' => $data['outlet_id'], 'customer_id' => $data['customer_id'] ?? null,
                'receipt_number' => 'POS-' . now()->format('ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
                'payment_method' => $data['payment_method'], 'subtotal' => $subtotal, 'discount' => $discount, 'total' => $total, 'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach ($lineItems as $line) {
                $product = $line['product'];
                DB::table('pos_sale_items')->insert(['sale_id' => $saleId, 'product_id' => $product->id, 'product_name' => $product->name, 'quantity' => $line['quantity'], 'unit_price' => $product->price, 'line_total' => $line['line_total'], 'created_at' => now(), 'updated_at' => now()]);
                $deductions = $product->is_bundle ? (json_decode($product->bundle_items ?? '[]', true) ?: []) : [['product_id' => $product->id, 'quantity' => 1]];
                foreach ($deductions as $part) {
                    $partProduct = DB::table('pos_products')->where('id', $part['product_id'])->lockForUpdate()->first();
                    $needed = (int) $part['quantity'] * $line['quantity'];
                    if (!$partProduct || $partProduct->stock < $needed) {
                        throw ValidationException::withMessages(['items' => "Komponen paket {$product->name} tidak mencukupi."]);
                    }
                    DB::table('pos_products')->where('id', $partProduct->id)->decrement('stock', $needed, ['updated_at' => now()]);
                }
            }
            if (!empty($data['customer_id'])) {
                DB::table('pos_customers')->where('id', $data['customer_id'])->lockForUpdate()->increment('total_spent', $total, ['points' => DB::raw('points + ' . (int) floor($total / 10000)), 'updated_at' => now()]);
            }
            return DB::table('pos_sales')->where('id', $saleId)->first();
        });
        return response()->json(['message' => 'Transaksi berhasil disimpan.', 'sale' => $result, 'items' => DB::table('pos_sale_items')->where('sale_id', $result->id)->get()], 201);
    }

    public function sales(Request $request): JsonResponse
    {
        $outlet = $request->query('outlet_id', 'outlet-jakarta');
        $from = $request->query('from', now()->toDateString());
        $to = $request->query('to', $from);
        $sales = DB::table('pos_sales')->where('outlet_id', $outlet)->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)->orderByDesc('created_at')->get();
        return response()->json(['sales' => $sales, 'summary' => ['transactions' => $sales->count(), 'revenue' => $sales->sum('total'), 'discounts' => $sales->sum('discount')]]);
    }

    public function customers(): JsonResponse
    {
        return response()->json(DB::table('pos_customers')->orderByDesc('total_spent')->get());
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => 'required|string|max:160', 'phone' => 'required|string|max:40|unique:pos_customers,phone']);
        $id = DB::table('pos_customers')->insertGetId($data + ['points' => 0, 'total_spent' => 0, 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(DB::table('pos_customers')->find($id), 201);
    }

    public function reservations(Request $request): JsonResponse
    {
        $query = DB::table('pos_reservations')->join('pos_reservation_spaces', 'pos_reservations.space_id', '=', 'pos_reservation_spaces.id')->select('pos_reservations.*', 'pos_reservation_spaces.name as space_name', 'pos_reservation_spaces.capacity as space_capacity')->orderBy('reservation_date')->orderBy('start_time');
        if ($request->filled('date')) $query->whereDate('reservation_date', $request->query('date'));
        if ($request->filled('outlet_id')) $query->where('pos_reservations.outlet_id', $request->query('outlet_id'));
        return response()->json($query->get());
    }

    public function spaces(Request $request): JsonResponse
    {
        return response()->json(DB::table('pos_reservation_spaces')->where('outlet_id', $request->query('outlet_id', 'outlet-jakarta'))->where('active', true)->orderBy('capacity')->orderBy('name')->get());
    }

    public function storeReservation(Request $request): JsonResponse
    {
        $data = $request->validate(['outlet_id' => 'required|string|max:64|exists:pos_outlets,id', 'space_id' => 'required|integer|exists:pos_reservation_spaces,id', 'customer_name' => 'required|string|max:160', 'phone' => 'nullable|string|max:40', 'party_size' => 'required|integer|min:1|max:40', 'reservation_date' => 'required|date|after_or_equal:today', 'start_time' => 'required|date_format:H:i', 'end_time' => 'required|date_format:H:i|after:start_time', 'notes' => 'nullable|string|max:1000']);
        $id = DB::transaction(function () use ($data) {
            DB::table('pos_outlets')->where('id', $data['outlet_id'])->lockForUpdate()->first();
            $space = DB::table('pos_reservation_spaces')->where('id', $data['space_id'])->where('outlet_id', $data['outlet_id'])->where('active', true)->lockForUpdate()->first();
            if (!$space || $space->capacity < $data['party_size']) throw ValidationException::withMessages(['space_id' => 'Ruang tidak sesuai kapasitas tamu atau outlet.']);
            $overlap = DB::table('pos_reservations')->where('space_id', $data['space_id'])->whereDate('reservation_date', $data['reservation_date'])->where('status', 'confirmed')->where('start_time', '<', $data['end_time'])->where('end_time', '>', $data['start_time'])->exists();
            if ($overlap) throw ValidationException::withMessages(['start_time' => 'Meja ini sudah dipesan pada waktu tersebut. Pilih meja atau waktu lain.']);
            return DB::table('pos_reservations')->insertGetId($data + ['status' => 'confirmed', 'created_at' => now(), 'updated_at' => now()]);
        });
        return response()->json(DB::table('pos_reservations')->find($id), 201);
    }

    private function withPhotoUrl(object $product): object
    {
        $product->photo_url = $product->photo_path ? Storage::disk('public')->url($product->photo_path) : null;
        return $product;
    }
}
