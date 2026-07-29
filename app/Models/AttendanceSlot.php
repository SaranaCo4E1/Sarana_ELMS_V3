<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceSlot extends Model
{
    protected $fillable = ['attendance_day_id', 'attendance_event_id', 'type', 'expected_at', 'status'];

    protected function casts(): array
    {
        return ['expected_at' => 'datetime'];
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(AttendanceDay::class, 'attendance_day_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(AttendanceEvent::class, 'attendance_event_id');
    }
}
