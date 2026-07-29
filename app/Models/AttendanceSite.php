<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AttendanceSite extends Model
{
    protected $fillable = [
        'name', 'code', 'timezone', 'latitude', 'longitude', 'acceptance_radius_meters',
        'maximum_accuracy_meters', 'allowed_ip_ranges', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'allowed_ip_ranges' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function qrCode(): HasOne
    {
        return $this->hasOne(AttendanceQrCode::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(AttendanceSchedule::class, 'primary_site_id');
    }
}
