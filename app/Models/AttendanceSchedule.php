<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceSchedule extends Model
{
    protected $fillable = [
        'user_id', 'primary_site_id', 'effective_from', 'work_start', 'lunch_start',
        'lunch_end', 'work_end', 'lunch_classification_lead_minutes', 'grace_minutes', 'created_by',
    ];

    protected function casts(): array
    {
        return ['effective_from' => 'date'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function primarySite(): BelongsTo
    {
        return $this->belongsTo(AttendanceSite::class, 'primary_site_id');
    }

    public function allowedSites(): BelongsToMany
    {
        return $this->belongsToMany(AttendanceSite::class, 'attendance_schedule_sites');
    }

    public function attendanceDays(): HasMany
    {
        return $this->hasMany(AttendanceDay::class);
    }
}
