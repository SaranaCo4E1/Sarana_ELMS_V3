<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class TelegramController extends Controller
{
    public function connect(Request $request): RedirectResponse
    {
        $botUsername = config('services.telegram.bot_username');

        abort_if(! $botUsername, 500, 'Telegram bot is not configured.');

        $token = Str::random(32);
        $request->user()->forceFill(['telegram_link_token' => $token])->save();

        return redirect()->away("https://t.me/{$botUsername}?start={$token}");
    }

    public function disconnect(Request $request): RedirectResponse
    {
        $request->user()->forceFill([
            'telegram_chat_id' => null,
            'telegram_link_token' => null,
        ])->save();

        return back()->with('success', 'Telegram disconnected.');
    }

    public function webhook(Request $request): Response
    {
        $secret = config('services.telegram.webhook_secret');

        abort_unless(
            $secret && hash_equals($secret, (string) $request->header('X-Telegram-Bot-Api-Secret-Token')),
            403
        );

        $chatId = $request->input('message.chat.id');
        $text = trim((string) $request->input('message.text'));

        if ($chatId && preg_match('/^\/start\s+(\S+)$/', $text, $matches)) {
            $user = User::query()->where('telegram_link_token', $matches[1])->first();

            if ($user) {
                $user->forceFill([
                    'telegram_chat_id' => (string) $chatId,
                    'telegram_link_token' => null,
                ])->save();

                $this->reply($chatId, "✅ Telegram connected! You'll now receive leave alerts here.");
            } else {
                $this->reply($chatId, '⚠️ This link has expired. Please generate a new one from your Profile page.');
            }
        } elseif ($chatId) {
            $this->reply($chatId, 'Open the "Connect Telegram" link from your ELMS Profile page to link this chat.');
        }

        return response('', 200);
    }

    private function reply(int|string $chatId, string $text): void
    {
        $botToken = config('services.telegram.bot_token');

        if (! $botToken) {
            return;
        }

        Http::asForm()->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
            'chat_id' => $chatId,
            'text' => $text,
        ]);
    }
}
