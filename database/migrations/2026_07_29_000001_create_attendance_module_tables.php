<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_sites', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 30)->unique();
            $table->string('timezone')->default('Asia/Phnom_Penh');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedInteger('acceptance_radius_meters')->default(150);
            $table->unsignedInteger('maximum_accuracy_meters')->default(100);
            $table->json('allowed_ip_ranges')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('attendance_qr_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_site_id')->unique()->constrained()->cascadeOnDelete();
            $table->uuid('public_id')->unique();
            $table->string('mode', 20)->default('daily');
            $table->text('secret');
            $table->boolean('is_enabled')->default(false);
            $table->timestamp('regenerated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('attendance_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('primary_site_id')->constrained('attendance_sites')->restrictOnDelete();
            $table->date('effective_from');
            $table->time('work_start')->default('08:00');
            $table->time('lunch_start')->default('12:00');
            $table->time('lunch_end')->default('13:00');
            $table->time('work_end')->default('17:00');
            $table->unsignedSmallInteger('lunch_classification_lead_minutes')->default(15);
            $table->unsignedSmallInteger('grace_minutes')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'effective_from']);
            $table->index(['user_id', 'effective_from']);
        });

        Schema::create('attendance_schedule_sites', function (Blueprint $table) {
            $table->foreignId('attendance_schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attendance_site_id')->constrained()->cascadeOnDelete();
            $table->primary(['attendance_schedule_id', 'attendance_site_id']);
        });

        Schema::create('attendance_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attendance_schedule_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('primary_site_id')->nullable()->constrained('attendance_sites')->nullOnDelete();
            $table->date('work_date');
            $table->string('timezone');
            $table->json('schedule_snapshot');
            $table->string('status', 20)->default('pending');
            $table->string('excuse_type', 30)->nullable();
            $table->unsignedBigInteger('excuse_reference_id')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'work_date']);
            $table->index(['work_date', 'status']);
        });

        Schema::create('attendance_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_day_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attendance_site_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('attendance_qr_code_id')->nullable()->constrained()->nullOnDelete();
            $table->string('direction', 10);
            $table->string('classification', 30)->default('ordinary');
            $table->timestamp('occurred_at');
            $table->timestamp('effective_at');
            $table->string('source', 20)->default('qr');
            $table->uuid('idempotency_key')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('accuracy_meters', 10, 2)->nullable();
            $table->decimal('distance_meters', 10, 2)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('geolocation_status', 30)->default('unavailable');
            $table->string('network_status', 30)->default('not_configured');
            $table->string('site_assignment_status', 30)->default('assigned');
            $table->string('verification_status', 20)->default('flagged');
            $table->json('flag_reasons')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('corrected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('correction_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_note')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['attendance_day_id', 'effective_at']);
        });

        Schema::create('attendance_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_day_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attendance_event_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 30);
            $table->timestamp('expected_at');
            $table->string('status', 20)->default('pending');
            $table->timestamps();
            $table->unique(['attendance_day_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_slots');
        Schema::dropIfExists('attendance_events');
        Schema::dropIfExists('attendance_days');
        Schema::dropIfExists('attendance_schedule_sites');
        Schema::dropIfExists('attendance_schedules');
        Schema::dropIfExists('attendance_qr_codes');
        Schema::dropIfExists('attendance_sites');
    }
};
