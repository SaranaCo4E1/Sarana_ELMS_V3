<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceDay extends Model
{
    protected $fillable = [
        'user_id', 'attendance_schedule_id', 'primary_site_id', 'work_date', 'timezone',
        'schedule_snapshot', 'status', 'excuse_type', 'excuse_reference_id', 'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'schedule_snapshot' => 'array',
            'finalized_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(AttendanceSchedule::class, 'attendance_schedule_id');
    }

    public function primarySite(): BelongsTo
    {
        return $this->belongsTo(AttendanceSite::class, 'primary_site_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(AttendanceEvent::class);
    }

    public function slots(): HasMany
    {
        return $this->hasMany(AttendanceSlot::class)->orderBy('expected_at');
    }
}
