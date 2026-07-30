<?php

namespace App\Http\Controllers;

use App\Models\AiChatLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AiAssistantController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $chatLogs = AiChatLog::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->limit(80)
            ->get(['id', 'conversation_id', 'prompt', 'response', 'created_at']);

        return Inertia::render('AiAssistant', [
            'recentChats' => $chatLogs
                ->groupBy(fn (AiChatLog $chatLog) => $chatLog->conversation_id ?: 'legacy-'.$chatLog->id)
                ->map(function ($conversationLogs, string $conversationId) {
                    $orderedLogs = $conversationLogs->sortBy('created_at')->values();
                    $latestLog = $orderedLogs->last();

                    return [
                        'id' => $conversationId,
                        'prompt' => $latestLog->prompt,
                        'response' => $latestLog->response,
                        'created_at' => $latestLog->created_at,
                        'messages' => $orderedLogs->map(fn (AiChatLog $chatLog) => [
                            'prompt' => $chatLog->prompt,
                            'response' => $chatLog->response,
                            'created_at' => $chatLog->created_at,
                        ])->all(),
                    ];
                })
                ->sortByDesc('created_at')
                ->values()
                ->take(8),
        ]);
    }
}
