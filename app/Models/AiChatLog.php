<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiChatLog extends Model
{
    protected $fillable = ['user_id', 'prompt', 'response', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }
}
