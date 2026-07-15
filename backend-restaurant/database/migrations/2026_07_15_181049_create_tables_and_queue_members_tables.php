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
        Schema::create('queue_members', function (Blueprint $table) {
            $table->id();
            $table->string('customer_name');
            $table->integer('party_size');
            $table->string('status')->default('waiting'); // waiting, seated, served, cancelled
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('seated_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('eating_time_minutes')->nullable();
            $table->timestamps();
        });

        Schema::create('tables', function (Blueprint $table) {
            $table->string('id')->primary(); // A, B, C, D
            $table->integer('capacity');
            $table->string('status')->default('vacant'); // vacant, dining
            $table->unsignedBigInteger('queue_member_id')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->integer('eating_time_minutes')->nullable();
            $table->timestamps();

            $table->foreign('queue_member_id')->references('id')->on('queue_members')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tables');
        Schema::dropIfExists('queue_members');
    }
};
