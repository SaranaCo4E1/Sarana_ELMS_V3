<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('manager_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->foreign('manager_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('leave_balances', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('leave_type_id')->references('id')->on('leave_types')->cascadeOnDelete();
        });

        Schema::table('leave_requests', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('leave_type_id')->references('id')->on('leave_types')->restrictOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('approver_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('leave_attachments', function (Blueprint $table) {
            $table->foreign('leave_request_id')->references('id')->on('leave_requests')->cascadeOnDelete();
            $table->foreign('uploaded_by')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('system_notifications', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('system_notifications', fn (Blueprint $table) => $table->dropForeign(['user_id']));
        Schema::table('leave_attachments', function (Blueprint $table) {
            $table->dropForeign(['leave_request_id']);
            $table->dropForeign(['uploaded_by']);
        });
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['leave_type_id']);
            $table->dropForeign(['department_id']);
            $table->dropForeign(['approver_id']);
        });
        Schema::table('leave_balances', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropForeign(['leave_type_id']);
        });
        Schema::table('departments', fn (Blueprint $table) => $table->dropForeign(['manager_id']));
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropForeign(['manager_id']);
        });
    }
};
