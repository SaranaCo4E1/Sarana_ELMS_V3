<?php

namespace App\Notifications;

use App\Models\LeaveRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LeaveRequestSubmitted extends Notification
{
    use Queueable;

    public function __construct(private readonly LeaveRequest $leaveRequest) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Leave request awaiting approval')
            ->line($this->leaveRequest->user->name.' submitted a '.$this->leaveRequest->leaveType->name.' request.')
            ->line('Dates: '.$this->leaveRequest->starts_at->toDateString().' to '.$this->leaveRequest->ends_at->toDateString())
            ->line('Working days: '.$this->leaveRequest->requested_days)
            ->action('Review request', route('approvals.index'));
    }
}
