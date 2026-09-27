<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_outlets', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('address')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
        Schema::create('pos_products', function (Blueprint $table) {
            $table->id();
            $table->string('outlet_id')->default('outlet-jakarta')->index();
            $table->string('name');
            $table->string('category')->default('Lainnya');
            $table->string('barcode')->nullable()->index();
            $table->string('photo_path')->nullable();
            $table->unsignedInteger('price');
            $table->unsignedInteger('stock')->default(0);
            $table->boolean('is_bundle')->default(false);
            $table->json('bundle_items')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
        Schema::create('pos_customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->unique();
            $table->unsignedInteger('points')->default(0);
            $table->unsignedInteger('total_spent')->default(0);
            $table->timestamps();
        });
        Schema::create('pos_sales', function (Blueprint $table) {
            $table->id();
            $table->string('outlet_id')->index();
            $table->foreignId('customer_id')->nullable()->constrained('pos_customers')->nullOnDelete();
            $table->string('receipt_number')->unique();
            $table->string('payment_method');
            $table->unsignedInteger('subtotal');
            $table->unsignedInteger('discount')->default(0);
            $table->unsignedInteger('total');
            $table->timestamps();
        });
        Schema::create('pos_reservation_spaces', function (Blueprint $table) {
            $table->id();
            $table->string('outlet_id')->index();
            $table->string('name');
            $table->unsignedInteger('capacity');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
        Schema::create('pos_sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('pos_sales')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('pos_products')->nullOnDelete();
            $table->string('product_name');
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('line_total');
            $table->timestamps();
        });
        Schema::create('pos_reservations', function (Blueprint $table) {
            $table->id();
            $table->string('outlet_id')->index();
            $table->foreignId('space_id')->constrained('pos_reservation_spaces')->cascadeOnDelete();
            $table->string('customer_name');
            $table->string('phone')->nullable();
            $table->unsignedInteger('party_size');
            $table->date('reservation_date')->index();
            $table->time('start_time');
            $table->time('end_time');
            $table->string('status')->default('confirmed');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_reservations');
        Schema::dropIfExists('pos_sale_items');
        Schema::dropIfExists('pos_sales');
        Schema::dropIfExists('pos_reservation_spaces');
        Schema::dropIfExists('pos_customers');
        Schema::dropIfExists('pos_products');
        Schema::dropIfExists('pos_outlets');
    }
};
