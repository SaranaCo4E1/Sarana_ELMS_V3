<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiFaq extends Model
{
    protected $fillable = [
        'key',
        'category',
        'question',
        'answer',
        'aliases_en',
        'aliases_km',
        'content_hash',
        'is_active',
    ];

    protected $hidden = ['embedding'];

    protected function casts(): array
    {
        return [
            'aliases_en' => 'array',
            'aliases_km' => 'array',
            'embedding' => 'array',
            'is_active' => 'boolean',
            'embedded_at' => 'datetime',
        ];
    }
}
