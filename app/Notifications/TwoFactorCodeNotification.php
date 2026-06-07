<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

class TwoFactorCodeNotification extends Notification
{
    use Queueable;

    public string $ip = 'Unknown IP';

    public string $userAgent = 'Unknown Browser';

    public function __construct(private readonly string $code)
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

        return (new MailMessage)
            ->subject('Your ELMS 2FA Code')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('Use the verification code below to complete your sign-in request.')
            ->line(new HtmlString('<table class="panel" width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="panel-content" style="text-align: center;"><span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #ff750f;">'.$this->code.'</span></td></tr></table>'))
            ->line('This code expires in 10 minutes.')
            ->line('### Request Details')
            ->line('**IP Address:** '.$this->ip)
            ->line('**Device/Browser:** '.$device)
            ->line('If you did not request this verification code, please secure your account immediately.');
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
