<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Demo attendance history
    |--------------------------------------------------------------------------
    |
    | DatabaseSeeder creates natural-looking attendance from this date through
    | yesterday. Both ISO (2026-07-28) and day-first (28/07/2026) are accepted.
    |
    */
    'seed_baseline_date' => env('ATTENDANCE_SEED_BASELINE_DATE', '2026-03-12'),

    /*
    | Keep lunch check-in available after the scheduled return time so a late
    | employee is recorded as late before the milestone becomes missing.
    */
    'lunch_return_window_minutes' => (int) env('ATTENDANCE_LUNCH_RETURN_WINDOW_MINUTES', 60),
];
