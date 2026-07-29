<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceEvent extends Model
{
    protected $fillable = [
        'attendance_day_id', 'user_id', 'attendance_site_id', 'attendance_qr_code_id',
        'direction', 'classification', 'occurred_at', 'effective_at', 'source', 'idempotency_key',
        'latitude', 'longitude', 'accuracy_meters', 'distance_meters', 'ip_address', 'user_agent',
        'geolocation_status', 'network_status', 'site_assignment_status', 'verification_status',
        'flag_reasons', 'voided_at', 'voided_by', 'corrected_by', 'correction_reason',
        'reviewed_at', 'reviewed_by', 'review_note',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'effective_at' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy_meters' => 'float',
            'distance_meters' => 'float',
            'flag_reasons' => 'array',
            'voided_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(AttendanceDay::class, 'attendance_day_id');
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(AttendanceSite::class, 'attendance_site_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
