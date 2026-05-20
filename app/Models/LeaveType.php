<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveType extends Model
{
    protected $fillable = ['name', 'code', 'default_allowance_days', 'paid', 'requires_attachment', 'deducts_balance', 'is_active'];

    protected function casts(): array
    {
        return [
            'default_allowance_days' => 'decimal:2',
            'paid' => 'boolean',
            'requires_attachment' => 'boolean',
            'deducts_balance' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function balances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class);
    }
}
