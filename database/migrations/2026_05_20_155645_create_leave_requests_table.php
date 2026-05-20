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
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->index();
            $table->foreignId('leave_type_id')->index();
            $table->foreignId('department_id')->nullable()->index();
            $table->foreignId('approver_id')->nullable()->index();
            $table->date('starts_at');
            $table->date('ends_at');
            $table->decimal('requested_days', 6, 2);
            $table->string('status')->default('pending')->index();
            $table->text('reason');
            $table->text('manager_comment')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leave_requests');
    }
};
