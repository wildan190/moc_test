<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('pos_products', 'photo_path')) {
            Schema::table('pos_products', function (Blueprint $table) {
                $table->string('photo_path')->nullable()->after('barcode');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('pos_products', 'photo_path')) {
            Schema::table('pos_products', function (Blueprint $table) {
                $table->dropColumn('photo_path');
            });
        }
    }
};
