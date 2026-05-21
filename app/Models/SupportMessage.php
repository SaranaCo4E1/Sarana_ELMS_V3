<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportMessage extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'email',
        'subject',
        'message',
    ];

    /**
     * Get the user that owns the support message.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
