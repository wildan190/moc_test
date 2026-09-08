<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('queue_members', function (Blueprint $table) {
            $table->json('pre_orders')->nullable()->after('eating_time_minutes');
        });

        Schema::table('tables', function (Blueprint $table) {
            $table->string('merged_with')->nullable()->after('eating_time_minutes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('queue_members', function (Blueprint $table) {
            $table->dropColumn('pre_orders');
        });

        Schema::table('tables', function (Blueprint $table) {
            $table->dropColumn('merged_with');
        });
    }
};
