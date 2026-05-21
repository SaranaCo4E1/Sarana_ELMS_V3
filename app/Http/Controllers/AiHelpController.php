<?php

namespace App\Http\Controllers;

use App\Models\AiChatLog;
use App\Models\AiFaq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function stream(Request $request): JsonResponse|StreamedResponse
    {
        $data = $request->validate([
            'prompt' => ['required', 'string', 'max:4000'],
            'messages' => ['sometimes', 'array', 'max:20'],
            'messages.*.role' => ['required_with:messages', 'in:user,assistant'],
            'messages.*.content' => ['required_with:messages', 'string', 'max:8000'],
        ]);

        $apiKey = config('services.google_generative_ai.key');

        if (! $apiKey) {
            return response()->json(['message' => 'Google Generative AI is not configured.'], 422);
        }

        return response()->stream(function () use ($request, $data, $apiKey) {
            $answer = '';
            $emittedError = false;
            $buffer = '';
            $payload = $this->buildGeminiPayload($request, $data);
            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s',
                rawurlencode(config('services.google_generative_ai.model')),
                rawurlencode($apiKey),
            );

            $curl = curl_init($url);

            curl_setopt_array($curl, [
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: text/event-stream'],
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_TIMEOUT => 90,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_WRITEFUNCTION => function ($curl, string $chunk) use (&$buffer, &$answer) {
                    $buffer .= $chunk;

                    while (($lineEnd = strpos($buffer, "\n")) !== false) {
                        $line = trim(substr($buffer, 0, $lineEnd));
                        $buffer = substr($buffer, $lineEnd + 1);

                        if (! str_starts_with($line, 'data:')) {
                            continue;
                        }

                        $json = trim(substr($line, 5));
                        $event = json_decode($json, true);

                        if (! is_array($event)) {
                            continue;
                        }

                        foreach (($event['candidates'][0]['content']['parts'] ?? []) as $part) {
                            $token = $part['text'] ?? '';

                            if ($token === '') {
                                continue;
                            }

                            $answer .= $token;
                            echo 'data: '.json_encode(['token' => $token])."\n\n";
                            flush();
                        }
                    }

                    return strlen($chunk);
                },
            ]);

            $ok = curl_exec($curl);
            $error = curl_error($curl);
            $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            curl_close($curl);

            if (($ok === false || $status >= 400) && $answer === '') {
                $emittedError = true;
                $message = $error ?: 'The AI service could not complete the request.';
                echo 'data: '.json_encode(['error' => $message])."\n\n";
            }

            if ($answer !== '') {
                AiChatLog::query()->create([
                    'user_id' => $request->user()->id,
                    'prompt' => $data['prompt'],
                    'response' => $answer,
                    'metadata' => [
                        'source' => 'gemini',
                        'model' => config('services.google_generative_ai.model'),
                    ],
                ]);
            }

            echo 'data: '.json_encode(['done' => true, 'saved' => $answer !== '', 'error' => $emittedError])."\n\n";
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * @param  array{prompt: string, messages?: array<int, array{role: string, content: string}>}  $data
     * @return array<string, mixed>
     */
    private function buildGeminiPayload(Request $request, array $data): array
    {
        $faqs = AiFaq::query()
            ->where('is_active', true)
            ->latest()
            ->limit(12)
            ->get(['question', 'answer'])
            ->map(fn (AiFaq $faq) => "Q: {$faq->question}\nA: {$faq->answer}")
            ->implode("\n\n");

        $messages = collect($data['messages'] ?? [])
            ->take(-18)
            ->map(fn (array $message) => [
                'role' => $message['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $message['content']]],
            ])
            ->values()
            ->all();

        $messages[] = [
            'role' => 'user',
            'parts' => [['text' => $data['prompt']]],
        ];

        return [
            'systemInstruction' => [
                'parts' => [[
                    'text' => implode("\n\n", array_filter([
                        'You are the AI assistant for an Employee Leave Management System. Answer clearly and practically about leave balances, policies, approvals, holidays, profile details, and HR workflows. If the question needs an HR decision or private data you cannot verify, say what the employee should check or who should contact HR.',
                        'Current user: '.$request->user()->name.' (role: '.$request->user()->role.', department: '.($request->user()->department?->name ?? 'No department').').',
                        $faqs ? "Active policy FAQ context:\n".$faqs : null,
                    ])),
                ]],
            ],
            'contents' => $messages,
            'generationConfig' => [
                'temperature' => 0.4,
                'topP' => 0.9,
                'maxOutputTokens' => 2048,
            ],
        ];
    }
}
