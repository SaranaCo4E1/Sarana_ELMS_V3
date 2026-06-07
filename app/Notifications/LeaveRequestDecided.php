<?php

namespace App\Notifications;

use App\Models\LeaveRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LeaveRequestDecided extends Notification
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
            ->subject('Leave request '.ucfirst($this->leaveRequest->status))
            ->line('Your '.$this->leaveRequest->leaveType->name.' request has been '.$this->leaveRequest->status.'.')
            ->line('Dates: '.$this->leaveRequest->starts_at->toDateString().' to '.$this->leaveRequest->ends_at->toDateString())
            ->line('Manager comment: '.($this->leaveRequest->manager_comment ?: 'No comment provided.'))
            ->action('View dashboard', route('dashboard'));
    }
}
