<?php

namespace App\Http\Controllers;

use App\Models\AiChatLog;
use App\Models\AiFaq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiHelpController extends Controller
{
    public function ask(Request $request): JsonResponse
    {
        $data = $request->validate(['prompt' => ['required', 'string', 'max:1000']]);

        $faq = AiFaq::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query
                ->where('question', 'like', '%'.$data['prompt'].'%')
                ->orWhere('answer', 'like', '%'.$data['prompt'].'%'))
            ->first();

        $response = $faq?->answer ?? 'No exact FAQ match is available yet. Please contact HR for this policy question.';

        AiChatLog::query()->create([
            'user_id' => $request->user()->id,
            'prompt' => $data['prompt'],
            'response' => $response,
            'metadata' => ['source' => $faq ? 'faq' : 'fallback'],
        ]);

        return response()->json(['answer' => $response]);
    }
}
