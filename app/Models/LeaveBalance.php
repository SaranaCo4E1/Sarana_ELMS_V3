<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveBalance extends Model
{
    protected $fillable = ['user_id', 'leave_type_id', 'year', 'allowance_days', 'carried_forward_days', 'used_days', 'pending_days', 'adjustment_days', 'override_reason'];

    protected $appends = ['available_days'];

    protected function casts(): array
    {
        return [
            'allowance_days' => 'decimal:2',
            'carried_forward_days' => 'decimal:2',
            'used_days' => 'decimal:2',
            'pending_days' => 'decimal:2',
            'adjustment_days' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function getAvailableDaysAttribute(): float
    {
        return (float) $this->allowance_days + (float) $this->carried_forward_days + (float) $this->adjustment_days - (float) $this->used_days - (float) $this->pending_days;
    }
}
