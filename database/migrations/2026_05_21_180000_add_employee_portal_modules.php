<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('job_title');
            $table->string('work_location')->nullable()->after('phone');
            $table->string('employment_type')->nullable()->after('work_location');
            $table->string('emergency_contact_name')->nullable()->after('employment_type');
            $table->string('emergency_contact_phone')->nullable()->after('emergency_contact_name');
            $table->text('bio')->nullable()->after('emergency_contact_phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'work_location',
                'employment_type',
                'emergency_contact_name',
                'emergency_contact_phone',
                'bio',
            ]);
        });
    }
};
