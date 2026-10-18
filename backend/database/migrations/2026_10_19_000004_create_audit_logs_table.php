<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * audit_logs (51:598): insert-only. A trigger rejects UPDATE and DELETE so
 * the rule holds for every client, including a hosted Postgres. actor_id and
 * target_id are plain references (no FK) so deleting a user never has to
 * rewrite history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('actor_id')->nullable()->index();
            $table->string('action')->index();
            $table->string('target_type');
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('from')->nullable();
            $table->string('to')->nullable();
            $table->text('reason')->nullable();
            $table->string('ip_hash', 64)->nullable();
            $table->jsonb('meta')->default('{}');
            $table->timestamp('created_at')->useCurrent()->index();

            $table->index(['target_type', 'target_id']);
        });

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION audit_logs_insert_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_logs is insert-only';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER audit_logs_no_update_delete
                BEFORE UPDATE OR DELETE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION audit_logs_insert_only();
        SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs');
        DB::unprepared('DROP FUNCTION IF EXISTS audit_logs_insert_only()');
        Schema::dropIfExists('audit_logs');
    }
};
