<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public string $ip = 'Unknown IP';

    public string $userAgent = 'Unknown Browser';

    public function __construct(public readonly string $token)
    {
        try {
            $request = request();
            if ($request instanceof Request) {
                $this->ip = $request->ip() ?? 'Unknown IP';
                $this->userAgent = $request->userAgent() ?? 'Unknown Browser';
            }
        } catch (\Throwable $e) {
            // Keep default values if request is not available
        }
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $device = $this->getReadableDevice($this->userAgent);
        $url = url(route('password.reset', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ], false));

        return (new MailMessage)
            ->subject('Reset Your ELMS Password')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('You are receiving this email because we received a password reset request for your ELMS account.')
            ->action('Reset Password', $url)
            ->line('This password reset link will expire in '.config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60).' minutes.')
            ->line('### Request Details')
            ->line('**IP Address:** '.$this->ip)
            ->line('**Device/Browser:** '.$device)
            ->line('If you did not request a password reset, no further action is required. Your account remains secure.');
    }

    private function getReadableDevice(string $userAgent): string
    {
        $platform = 'Unknown OS';
        if (preg_match('/windows|win32/i', $userAgent)) {
            $platform = 'Windows';
        } elseif (preg_match('/macintosh|mac os x/i', $userAgent)) {
            $platform = 'macOS';
        } elseif (preg_match('/linux/i', $userAgent)) {
            $platform = 'Linux';
        } elseif (preg_match('/iphone|ipad/i', $userAgent)) {
            $platform = 'iOS';
        } elseif (preg_match('/android/i', $userAgent)) {
            $platform = 'Android';
        }

        $browser = 'Unknown Browser';
        if (preg_match('/edge|edg/i', $userAgent)) {
            $browser = 'Microsoft Edge';
        } elseif (preg_match('/chrome/i', $userAgent)) {
            $browser = 'Google Chrome';
        } elseif (preg_match('/safari/i', $userAgent)) {
            $browser = 'Apple Safari';
        } elseif (preg_match('/firefox/i', $userAgent)) {
            $browser = 'Mozilla Firefox';
        } elseif (preg_match('/opera|opr/i', $userAgent)) {
            $browser = 'Opera';
        }

        return "$browser on $platform";
    }
}
