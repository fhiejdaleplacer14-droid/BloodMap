<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Promotion to Administrator needs a second administrator (39:1074, decision #10). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('from_role');
            $table->string('to_role');
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('coordination_point_id')->nullable()->constrained()->nullOnDelete();
            $table->text('reason');
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('pending')->index(); // pending|approved|declined
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_changes');
    }
};
