<?php

namespace App\Http\Controllers;

use App\Models\AiChatLog;
use App\Models\AiFaq;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AiHelpController extends Controller
{
    public function ask(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prompt' => ['required', 'string', 'max:1000'],
            'conversation_id' => ['nullable', 'uuid'],
        ]);

        $faq = AiFaq::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query
                ->where('question', 'like', '%'.$data['prompt'].'%')
                ->orWhere('answer', 'like', '%'.$data['prompt'].'%'))
            ->first();

        $response = $faq?->answer ?? 'No exact FAQ match is available yet. Please contact HR for this policy question.';

        AiChatLog::query()->create([
            'user_id' => $request->user()->id,
            'conversation_id' => $data['conversation_id'] ?? null,
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
            'conversation_id' => ['nullable', 'uuid'],
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
            $intent = $this->classifyPromptIntent($data['prompt'], $apiKey);
            $data['intent'] = $intent;
            $payload = $this->buildGeminiPayload($request, $data);
            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s',
                rawurlencode(config('services.google_generative_ai.model')),
                rawurlencode($apiKey),
            );

            echo 'data: '.json_encode(['intent' => $intent])."\n\n";
            flush();

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
                    'conversation_id' => $data['conversation_id'] ?? null,
                    'prompt' => $data['prompt'],
                    'response' => $answer,
                    'metadata' => [
                        'source' => 'gemini',
                        'model' => config('services.google_generative_ai.model'),
                        'intent' => $intent,
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
     * @param  array{prompt: string, intent?: string, messages?: array<int, array{role: string, content: string}>}  $data
     * @return array<string, mixed>
     */
    private function buildGeminiPayload(Request $request, array $data): array
    {
        $user = $request->user()->loadMissing(['department', 'manager', 'leaveBalances.leaveType']);
        $isLeaveDraft = ($data['intent'] ?? null) === 'leave_draft';
        $now = now();
        $faqs = AiFaq::query()
            ->where('is_active', true)
            ->latest()
            ->limit(12)
            ->get(['question', 'answer'])
            ->map(fn (AiFaq $faq) => "Q: {$faq->question}\nA: {$faq->answer}")
            ->implode("\n\n");
        $balanceContext = $this->buildLeaveBalanceContext($request);
        $leaveContext = $isLeaveDraft ? $this->buildLeaveDraftContext($request) : null;

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
                        'You are the AI assistant for an Employee Leave Management System. Answer only questions that directly support employee leave, attendance-adjacent HR workflows, leave balances, policies, approvals, holidays, profile details, and leave request drafting. If the user asks for anything outside this scope, briefly refuse and redirect them to leave-management topics you can help with. If the question needs an HR decision or private data you cannot verify, say what the employee should check or who should contact HR.',
                        $isLeaveDraft
                            ? "The user is drafting a leave application. Use the leave-system context below to choose the closest active leave type, normalize dates, and prepare a useful application note.\n\nRespond in this exact structure:\nDraft request ready.\nLeave type: <one active leave type name or Review in form>\nStart date: <YYYY-MM-DD or Review in form>\nEnd date: <YYYY-MM-DD or Review in form>\nDuration: <full_day or half_day>\nApplication note:\n<2-4 professional sentences suitable for the leave request reason/handover field. Include coverage or handover context when the prompt implies it. Do not invent medical details, destinations, clients, or private facts.>\n\nKeep the response concise and do not add extra sections."
                            : null,
                        'Current user: '.$user->name.' (role: '.$user->role.', department: '.($user->department?->name ?? 'No department').', manager: '.($user->manager?->name ?? 'No assigned manager').').',
                        'Current date and time: '.$now->format('Y-m-d H:i:s').' ('.$now->timezoneName.'). Use this as the anchor for relative dates like today, tomorrow, next week, or next Friday.',
                        $balanceContext,
                        $leaveContext,
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

    private function classifyPromptIntent(string $prompt, string $apiKey): string
    {
        $model = config('services.google_generative_ai.classifier_model', 'gemini-2.5-flash-lite');
        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
            rawurlencode($model),
            rawurlencode($apiKey),
        );
        $payload = [
            'systemInstruction' => [
                'parts' => [[
                    'text' => implode("\n", [
                        'Classify the user prompt for an employee leave management assistant.',
                        'Return exactly one label: leave_draft or general.',
                        'Use leave_draft only when the user wants to create, draft, prepare, submit, book, or populate a leave/time-off application.',
                        'Use general for questions about balances, allowance, policy, eligibility, approval process, holidays, or explanations, even if the prompt contains the word leave.',
                        'Examples:',
                        '"How much annual leave can I use this month?" => general',
                        '"What happens after I submit a leave request?" => general',
                        '"Draft annual leave for May 25 to May 28" => leave_draft',
                        '"Apply for sick leave tomorrow" => leave_draft',
                    ]),
                ]],
            ],
            'contents' => [[
                'role' => 'user',
                'parts' => [['text' => $prompt]],
            ]],
            'generationConfig' => [
                'temperature' => 0,
                'topP' => 1,
                'maxOutputTokens' => 8,
            ],
        ];
        $curl = curl_init($url);

        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $response = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        if (! is_string($response) || $status >= 400) {
            return 'general';
        }

        $decoded = json_decode($response, true);
        $label = strtolower(trim((string) ($decoded['candidates'][0]['content']['parts'][0]['text'] ?? '')));

        return str_contains($label, 'leave_draft') ? 'leave_draft' : 'general';
    }

    private function buildLeaveBalanceContext(Request $request): string
    {
        $user = $request->user()->loadMissing(['leaveBalances.leaveType']);
        $balances = $user->leaveBalances
            ->where('year', now()->year)
            ->map(fn ($balance) => sprintf(
                '- %s (%s): %s available, %s pending, %s used, %s allowance, %s carried forward, %s adjustment',
                $balance->leaveType?->name ?? 'Unknown leave type',
                $balance->leaveType?->code ?? 'N/A',
                number_format((float) $balance->available_days, 1),
                number_format((float) $balance->pending_days, 1),
                number_format((float) $balance->used_days, 1),
                number_format((float) $balance->allowance_days, 1),
                number_format((float) $balance->carried_forward_days, 1),
                number_format((float) $balance->adjustment_days, 1),
            ))
            ->implode("\n");

        return "Current-year leave balances:\n".($balances ?: '- No leave balances are available for the current year.');
    }

    private function buildLeaveDraftContext(Request $request): string
    {
        $user = $request->user()->loadMissing(['department', 'manager', 'leaveBalances.leaveType']);
        $leaveTypes = LeaveType::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (LeaveType $type) => sprintf(
                '- %s (%s): default %s days, %s, %s, %s balance',
                $type->name,
                $type->code,
                $type->default_allowance_days,
                $type->paid ? 'paid' : 'unpaid',
                $type->requires_attachment ? 'requires attachment' : 'no attachment required',
                $type->deducts_balance ? 'deducts' : 'does not deduct',
            ))
            ->implode("\n");
        $balances = $user->leaveBalances
            ->where('year', now()->year)
            ->map(fn ($balance) => sprintf(
                '- %s: %s available, %s pending, %s used of %s allowance',
                $balance->leaveType?->name ?? 'Unknown leave type',
                number_format((float) $balance->available_days, 1),
                number_format((float) $balance->pending_days, 1),
                number_format((float) $balance->used_days, 1),
                number_format((float) $balance->allowance_days, 1),
            ))
            ->implode("\n");
        $holidays = PublicHoliday::query()
            ->where('is_active', true)
            ->whereDate('holiday_date', '>=', now()->toDateString())
            ->orderBy('holiday_date')
            ->limit(12)
            ->get()
            ->map(fn (PublicHoliday $holiday) => '- '.$holiday->holiday_date->toDateString().': '.$holiday->name)
            ->implode("\n");
        $recentRequests = $user->leaveRequests()
            ->with('leaveType')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn ($leaveRequest) => sprintf(
                '- %s %s to %s, %s days, status %s',
                $leaveRequest->leaveType?->name ?? 'Leave',
                $leaveRequest->starts_at->toDateString(),
                $leaveRequest->ends_at->toDateString(),
                number_format((float) $leaveRequest->requested_days, 1),
                $leaveRequest->status,
            ))
            ->implode("\n");

        return implode("\n\n", array_filter([
            "Leave draft context:",
            "Active leave types:\n".($leaveTypes ?: '- None configured'),
            "Current-year balances for {$user->name}:\n".($balances ?: '- No balances available'),
            "Upcoming active public holidays:\n".($holidays ?: '- No upcoming holidays configured'),
            "Recent leave requests:\n".($recentRequests ?: '- No recent requests'),
        ]));
    }
}
