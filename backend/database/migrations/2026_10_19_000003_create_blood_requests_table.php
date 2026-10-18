<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * No street/address columns and no structured patient fields (51:578, 51:583).
 * Location = the coordination point's municipality (centroid only in public).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blood_requests', function (Blueprint $table) {
            $table->id();
            $table->string('public_id')->nullable()->unique(); // BM-2026-0012
            $table->foreignId('submitter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('coordination_point_id')->constrained()->restrictOnDelete();
            $table->foreignId('municipality_id')->constrained()->restrictOnDelete();

            $table->string('blood_type', 3);
            $table->unsignedSmallInteger('units_requested')->nullable();
            $table->date('needed_by')->nullable();
            // Desk time window on the needed-by date (31:241); expiry = needed_by + window end, PHT.
            $table->time('desk_window_start')->nullable();
            $table->time('desk_window_end')->nullable();
            // Derived from needed_by when submitted (decision #16).
            $table->string('urgency')->default('scheduled');
            $table->string('category')->nullable();
            $table->string('status')->default('draft')->index();
            $table->string('public_summary', 280)->default('');
            $table->string('response_instructions', 400)->default('');

            // Contact always comes from the approved coordination point (31:588).
            $table->string('contact_method')->default('desk_phone');
            $table->string('contact_visible_to')->default('signed_in');

            // Automated checks (submit job) — warnings for coordinators only.
            $table->jsonb('screening_flags')->default('[]');
            $table->boolean('possible_duplicate')->default(false);

            $table->foreignId('assigned_coordinator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('correction_note')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('closure_reason')->nullable();

            // Queue position survives a correction round-trip (55:331).
            $table->timestamp('first_submitted_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('extended_at')->nullable();
            // "Remind me 6 hours before a saved request expires" (29:1145) — sent once.
            $table->timestamp('expiry_reminder_sent_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->boolean('is_demo')->default(false);
            $table->timestamps();

            $table->index(['status', 'updated_at']);
        });

        Schema::create('saved_requests', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('blood_request_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['user_id', 'blood_request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_requests');
        Schema::dropIfExists('blood_requests');
    }
};
