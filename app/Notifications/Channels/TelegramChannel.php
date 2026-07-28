<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toTelegram')) {
            return;
        }

        $botToken = config('services.telegram.bot_token');
        $chatId = $notifiable->telegram_chat_id ?? null;

        if (! $botToken) {
            Log::info('Telegram alert skipped: TELEGRAM_BOT_TOKEN is not configured.', [
                'notification' => $notification::class,
                'notifiable_id' => $notifiable->id ?? null,
            ]);

            return;
        }

        if (! $chatId) {
            Log::info('Telegram alert skipped: recipient has no linked Telegram chat_id.', [
                'notification' => $notification::class,
                'notifiable_id' => $notifiable->id ?? null,
            ]);

            return;
        }

        $text = $notification->toTelegram($notifiable);

        try {
            $response = Http::asForm()->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ])->throw();

            Log::info('Telegram alert sent.', [
                'notification' => $notification::class,
                'notifiable_id' => $notifiable->id ?? null,
                'chat_id' => $chatId,
                'response' => $response->json(),
            ]);
        } catch (Throwable $e) {
            Log::warning('Telegram alert failed to send.', [
                'notification' => $notification::class,
                'notifiable_id' => $notifiable->id ?? null,
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
