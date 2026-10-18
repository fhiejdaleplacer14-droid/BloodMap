<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('donor')->index();
            // Shown instead of names in review queues ("S-0142").
            $table->string('reference')->nullable()->unique();
            $table->foreignId('area_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('coordination_point_id')->nullable()->constrained()->nullOnDelete();
            $table->jsonb('preferences')->default('{}');
            $table->timestamp('restricted_at')->nullable();
            $table->string('restriction_reason')->nullable();
            $table->timestamp('deletion_requested_at')->nullable()->index();
            $table->timestamp('last_active_at')->nullable();
            $table->boolean('is_demo')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('area_id');
            $table->dropConstrainedForeignId('coordination_point_id');
            $table->dropColumn([
                'role', 'reference', 'preferences', 'restricted_at', 'restriction_reason',
                'deletion_requested_at', 'last_active_at', 'is_demo',
            ]);
        });
    }
};
