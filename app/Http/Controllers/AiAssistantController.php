<?php

namespace App\Http\Controllers;

use App\Models\AiChatLog;
use App\Models\AiFaq;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AiAssistantController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('AiAssistant', [
            'faqs' => AiFaq::query()->where('is_active', true)->latest()->limit(20)->get(),
            'recentChats' => AiChatLog::query()
                ->where('user_id', $request->user()->id)
                ->latest()
                ->limit(8)
                ->get(['id', 'prompt', 'response', 'created_at']),
        ]);
    }
}
