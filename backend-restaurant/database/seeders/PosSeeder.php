<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PosSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('pos_outlets')->updateOrInsert(['id' => 'outlet-jakarta'], ['name' => 'PADA Jakarta', 'address' => 'Jakarta', 'active' => true, 'updated_at' => now(), 'created_at' => now()]);
        DB::table('pos_outlets')->updateOrInsert(['id' => 'outlet-bandung'], ['name' => 'PADA Bandung', 'address' => 'Bandung', 'active' => true, 'updated_at' => now(), 'created_at' => now()]);
        foreach (['outlet-jakarta', 'outlet-bandung'] as $outletId) {
            foreach ([['Meja 1', 2], ['Meja 2', 4], ['Meja 3', 4], ['Meja 4', 6], ['Ruang keluarga', 10]] as [$name, $capacity]) {
                DB::table('pos_reservation_spaces')->updateOrInsert(['outlet_id' => $outletId, 'name' => $name], ['capacity' => $capacity, 'active' => true, 'updated_at' => now(), 'created_at' => now()]);
            }
        }
        $products = [
            ['name' => 'Nasi Goreng Kampung', 'category' => 'Makanan', 'barcode' => '899100100001', 'price' => 38000, 'stock' => 48],
            ['name' => 'Ayam Bakar Madu', 'category' => 'Makanan', 'barcode' => '899100100002', 'price' => 52000, 'stock' => 32],
            ['name' => 'Beef Burger', 'category' => 'Makanan', 'barcode' => '899100100003', 'price' => 65000, 'stock' => 24],
            ['name' => 'Pasta Carbonara', 'category' => 'Makanan', 'barcode' => '899100100004', 'price' => 58000, 'stock' => 28],
            ['name' => 'Es Kopi Susu', 'category' => 'Minuman', 'barcode' => '899100100005', 'price' => 24000, 'stock' => 80],
            ['name' => 'Lemon Tea', 'category' => 'Minuman', 'barcode' => '899100100006', 'price' => 18000, 'stock' => 65],
            ['name' => 'Kentang Goreng', 'category' => 'Snack', 'barcode' => '899100100007', 'price' => 26000, 'stock' => 40],
        ];
        foreach (['outlet-jakarta', 'outlet-bandung'] as $outletId) {
            $ids = [];
            foreach ($products as $product) {
                DB::table('pos_products')->updateOrInsert(['outlet_id' => $outletId, 'barcode' => $product['barcode']], $product + ['outlet_id' => $outletId, 'is_bundle' => false, 'active' => true, 'updated_at' => now(), 'created_at' => now()]);
                $ids[$product['barcode']] = DB::table('pos_products')->where('outlet_id', $outletId)->where('barcode', $product['barcode'])->value('id');
            }
            $bundle = ['name' => 'Paket Hemat Berdua', 'category' => 'Paket', 'barcode' => '899100100008', 'price' => 89000, 'stock' => 0, 'is_bundle' => true, 'bundle_items' => json_encode([['product_id' => $ids['899100100001'], 'quantity' => 1], ['product_id' => $ids['899100100005'], 'quantity' => 1], ['product_id' => $ids['899100100007'], 'quantity' => 1]])];
            DB::table('pos_products')->updateOrInsert(['outlet_id' => $outletId, 'barcode' => $bundle['barcode']], $bundle + ['outlet_id' => $outletId, 'active' => true, 'updated_at' => now(), 'created_at' => now()]);
        }
    }
}
