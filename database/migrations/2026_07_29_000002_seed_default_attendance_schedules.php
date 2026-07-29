<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $siteId = DB::table('attendance_sites')->insertGetId([
            'name' => 'Phnom Penh Office',
            'code' => 'PNH',
            'timezone' => 'Asia/Phnom_Penh',
            'acceptance_radius_meters' => 150,
            'maximum_accuracy_meters' => 100,
            'allowed_ip_ranges' => json_encode([]),
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('attendance_qr_codes')->insert([
            'attendance_site_id' => $siteId,
            'public_id' => (string) Str::uuid(),
            'mode' => 'daily',
            'secret' => Crypt::encryptString(Str::random(64)),
            'is_enabled' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('users')->where('is_active', true)->orderBy('id')->get(['id', 'hire_date'])->each(function ($user) use ($siteId, $now) {
            $effectiveFrom = $now->toDateString();
            if ($user->hire_date && $user->hire_date > $effectiveFrom) {
                $effectiveFrom = $user->hire_date;
            }
            $scheduleId = DB::table('attendance_schedules')->insertGetId([
                'user_id' => $user->id,
                'primary_site_id' => $siteId,
                'effective_from' => $effectiveFrom,
                'work_start' => '08:00:00',
                'lunch_start' => '12:00:00',
                'lunch_end' => '13:00:00',
                'work_end' => '17:00:00',
                'lunch_classification_lead_minutes' => 15,
                'grace_minutes' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('attendance_schedule_sites')->insert([
                'attendance_schedule_id' => $scheduleId,
                'attendance_site_id' => $siteId,
            ]);
        });
    }

    public function down(): void
    {
        // Attendance table removal is handled by the preceding schema migration.
    }
};
