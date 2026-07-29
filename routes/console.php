<?php

use App\Services\AttendanceService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('telegram:set-webhook', function () {
    $botToken = config('services.telegram.bot_token');
    $secret = config('services.telegram.webhook_secret');

    if (! $botToken) {
        $this->error('TELEGRAM_BOT_TOKEN is not set in .env.');

        return 1;
    }

    $url = route('telegram.webhook');

    if (! str_starts_with($url, 'https://')) {
        $this->error("Telegram requires an HTTPS URL. Resolved URL was: {$url}");

        return 1;
    }

    $response = Http::post("https://api.telegram.org/bot{$botToken}/setWebhook", [
        'url' => $url,
        'secret_token' => $secret,
    ]);

    $this->line($response->body());

    return $response->successful() && $response->json('ok') ? 0 : 1;
})->purpose('Register the app\'s webhook URL with Telegram so it can receive /start messages');

Artisan::command('attendance:reconcile', function (AttendanceService $attendance) {
    $this->info('Processed '.$attendance->reconcileDueDays().' attendance schedules.');
})->purpose('Materialize and finalize due attendance days');

Schedule::command('attendance:reconcile')->everyFiveMinutes()->withoutOverlapping();
