<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class AttendanceQrCode extends Model
{
    protected $fillable = ['attendance_site_id', 'public_id', 'mode', 'secret', 'is_enabled', 'regenerated_at'];

    protected function casts(): array
    {
        return [
            'secret' => 'encrypted',
            'is_enabled' => 'boolean',
            'regenerated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $code) {
            $code->public_id ??= (string) Str::uuid();
            $code->secret ??= Str::random(64);
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(AttendanceSite::class, 'attendance_site_id');
    }
}
