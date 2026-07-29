<?php

namespace App\Notifications;

use App\Models\AttendanceEvent;
use App\Notifications\Channels\TelegramChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AttendanceFlagged extends Notification
{
    use Queueable;

    public function __construct(private readonly AttendanceEvent $event) {}

    public function via(object $notifiable): array
    {
        return [TelegramChannel::class, 'mail'];
    }

    public function toTelegram(object $notifiable): string
    {
        $event = $this->event->loadMissing(['user.department', 'site', 'day']);

        return '⚠️ <b>Flagged Attendance '.e(ucfirst($event->direction))."</b>\n"
            .'<b>Employee:</b> '.e($event->user->name).' ('.e($event->user->department?->name ?? 'N/A').")\n"
            .'<b>Time:</b> '.e($this->localTime($event))."\n"
            .'<b>Branch:</b> '.e($event->site?->name ?? 'Unknown branch')."\n"
            .'<b>Reason:</b> '.e($this->reasonText($event));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $event = $this->event->loadMissing(['user.department', 'site', 'day']);

        return (new MailMessage)
            ->subject('Flagged attendance '.$event->direction.': '.$event->user->name)
            ->greeting('Hello '.$notifiable->name.',')
            ->line($event->user->name.' recorded a flagged attendance '.$event->direction.'.')
            ->line('**Employee:** '.$event->user->name.' ('.($event->user->department?->name ?? 'N/A').')')
            ->line('**Time:** '.$this->localTime($event))
            ->line('**Branch:** '.($event->site?->name ?? 'Unknown branch'))
            ->line('**Reason:** '.$this->reasonText($event))
            ->action('Review Attendance', route('attendance.index', ['tab' => 'records']))
            ->line('Please review the attendance evidence and resolve or correct the event.');
    }

    private function localTime(AttendanceEvent $event): string
    {
        return $event->effective_at
            ->copy()
            ->setTimezone($event->day->timezone)
            ->format('M d, Y H:i');
    }

    private function reasonText(AttendanceEvent $event): string
    {
        $labels = [
            'denied' => 'Location permission was denied',
            'unavailable' => 'Location could not be determined',
            'timeout' => 'Location request timed out',
            'low_accuracy' => 'Location accuracy was too low',
            'outside_geofence' => 'Location was outside the branch boundary',
            'not_allowed' => 'Network IP was outside the branch allowed ranges',
            'not_configured' => 'No allowed network range was configured',
            'unassigned_site' => 'This branch was not assigned to the employee',
        ];

        return collect($event->flag_reasons ?? [])
            ->map(fn (string $reason) => $labels[$reason] ?? str_replace('_', ' ', $reason))
            ->implode('; ');
    }
}
