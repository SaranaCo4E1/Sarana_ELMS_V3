<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('attendance_days')
            ->whereNotNull('excuse_type')
            ->update(['status' => 'not_applicable']);

        DB::table('attendance_days')
            ->where('excuse_type', 'approved_leave')
            ->update(['status' => 'on_leave']);

        DB::table('attendance_days')
            ->where('excuse_type', 'public_holiday')
            ->update(['status' => 'holiday']);

        DB::table('attendance_days')
            ->where('excuse_type', 'weekend')
            ->update(['status' => 'weekend']);

        DB::table('attendance_slots')
            ->whereIn(
                'attendance_day_id',
                DB::table('attendance_days')->whereNotNull('excuse_type')->select('id')
            )
            ->update(['status' => 'not_applicable']);
    }

    public function down(): void
    {
        // This data normalization is intentionally irreversible.
    }
};
