<?php

namespace App\Services;

use App\Models\AttendanceQrCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class AttendanceQrService
{
    public function token(AttendanceQrCode $code, ?Carbon $at = null): string
    {
        $code->loadMissing('site');
        $at ??= now();
        $context = $code->mode === 'daily'
            ? $at->copy()->setTimezone($code->site->timezone)->format('Y-m-d')
            : 'static';

        return hash_hmac('sha256', $context, $code->secret);
    }

    public function isValid(AttendanceQrCode $code, ?string $token, ?Carbon $at = null): bool
    {
        return $code->is_enabled
            && $code->site?->is_active
            && filled($token)
            && hash_equals($this->token($code, $at), (string) $token);
    }

    public function regenerate(AttendanceQrCode $code): void
    {
        $code->update([
            'secret' => Str::random(64),
            'regenerated_at' => now(),
        ]);
    }

    public function scanUrl(AttendanceQrCode $code): string
    {
        return route('attendance.scan', [
            'qrCode' => $code,
            'token' => $this->token($code),
        ]);
    }
}
