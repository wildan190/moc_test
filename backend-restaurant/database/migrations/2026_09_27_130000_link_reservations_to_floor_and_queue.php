<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('pos_reservation_spaces', 'table_id')) {
            Schema::table('pos_reservation_spaces', function (Blueprint $table) {
                $table->string('table_id')->nullable()->index();
            });
        }

        Schema::table('pos_reservations', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_reservations', 'queue_member_id')) {
                $table->unsignedBigInteger('queue_member_id')->nullable()->unique();
            }
            if (!Schema::hasColumn('pos_reservations', 'arrived_at')) {
                $table->timestamp('arrived_at')->nullable();
            }
        });

        Schema::table('queue_members', function (Blueprint $table) {
            if (!Schema::hasColumn('queue_members', 'source')) {
                $table->string('source')->default('walk_in');
            }
            if (!Schema::hasColumn('queue_members', 'reservation_id')) {
                $table->unsignedBigInteger('reservation_id')->nullable()->unique();
            }
        });

        Schema::table('pos_reservations', function (Blueprint $table) {
            $table->foreign('queue_member_id')->references('id')->on('queue_members')->nullOnDelete();
        });
        Schema::table('queue_members', function (Blueprint $table) {
            $table->foreign('reservation_id')->references('id')->on('pos_reservations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('queue_members', function (Blueprint $table) {
            $table->dropForeign(['reservation_id']);
            $table->dropUnique(['reservation_id']);
            $table->dropColumn(['source', 'reservation_id']);
        });
        Schema::table('pos_reservations', function (Blueprint $table) {
            $table->dropForeign(['queue_member_id']);
            $table->dropUnique(['queue_member_id']);
            $table->dropColumn(['queue_member_id', 'arrived_at']);
        });
        Schema::table('pos_reservation_spaces', function (Blueprint $table) {
            $table->dropIndex(['table_id']);
            $table->dropColumn('table_id');
        });
    }
};
