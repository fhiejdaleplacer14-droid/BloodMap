<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Plain PostgreSQL — no PostGIS (docs/decisions.md #4). Municipalities carry
 * their centroid; requests only ever expose that centroid (decision #5).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Coordinator areas, e.g. "Negros Occidental (North)".
        Schema::create('areas', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('short_name');
            $table->timestamps();
        });

        Schema::create('municipalities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('province');
            $table->foreignId('area_id')->constrained()->restrictOnDelete();
            $table->decimal('centroid_lat', 9, 6);
            $table->decimal('centroid_lng', 9, 6);
            $table->timestamps();

            $table->unique(['name', 'province']);
            $table->index(['centroid_lat', 'centroid_lng']);
        });

        // Public facility desks. Requests attach here, never to a person.
        Schema::create('coordination_points', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('municipality_id')->constrained()->restrictOnDelete();
            // Published institutional location (may be plotted — 55:249).
            $table->decimal('lat', 9, 6);
            $table->decimal('lng', 9, 6);
            $table->string('hours')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_demo')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coordination_points');
        Schema::dropIfExists('municipalities');
        Schema::dropIfExists('areas');
    }
};
