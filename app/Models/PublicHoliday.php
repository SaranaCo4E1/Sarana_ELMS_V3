<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublicHoliday extends Model
{
    protected $fillable = ['holiday_date', 'name', 'is_active'];

    protected function casts(): array
    {
        return ['holiday_date' => 'date', 'is_active' => 'boolean'];
    }
}
