<?php

namespace App\Services\Ai;

use App\Models\User;
use App\Services\AttendanceService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class AiPromptPlanner
{
    private const TOOL_NAMES = [
        'get_leave_roster',
        'get_attendance_summary',
        'get_my_leave_balances',
        'get_my_leave_requests',
        'get_holidays',
        'get_leave_draft_context',
    ];

    public function __construct(private AttendanceService $attendanceService) {}

    /**
     * @return array{
     *     intent: 'general'|'leave_draft',
     *     timezone: string,
     *     calls: array<int, array{id: ?string, name: string, args: array<string, mixed>}>,
     *     model_content: ?array<string, mixed>
     * }
     */
    public function plan(User $actor, string $prompt, array $messages = []): array
    {
        $timezone = $this->timezone($actor);
        $now = now($timezone);
        $fallback = $this->fallbackPlan($prompt, $now, $timezone);
        $apiKey = config('services.google_generative_ai.key');

        if (! is_string($apiKey) || trim($apiKey) === '') {
            return $fallback;
        }

        try {
            $response = $this->request($apiKey)
                ->post(sprintf(
                    'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent',
                    rawurlencode((string) config('services.google_generative_ai.model')),
                ), [
                    'systemInstruction' => [
                        'parts' => [[
                            'text' => implode("\n", [
                                'Select read-only ELMS functions only when current application data is required.',
                                'Do not call functions for static policy/company questions or organization-directory questions about departments, department managers, employee counts, the current user\'s manager, management chain, or teammates; those are supplied separately in the final prompt.',
                                'Use get_leave_roster for approved absences over a date range.',
                                'Use get_attendance_summary only for the current user\'s attendance metrics.',
                                'Use get_my_leave_balances for the current user\'s balances.',
                                'Use get_my_leave_requests for the current user\'s request history or status.',
                                'Use get_holidays for configured holidays over a date range.',
                                'Use get_leave_draft_context when the user wants to create, draft, prepare, submit, book, or populate a leave request.',
                                'Resolve relative dates using the supplied current time and timezone.',
                                'Call no more than two functions.',
                                "Current time: {$now->toIso8601String()}",
                                "Timezone: {$timezone}",
                            ]),
                        ]],
                    ],
                    'contents' => $this->contents($messages, $prompt),
                    'tools' => $this->tools(),
                    'toolConfig' => [
                        'functionCallingConfig' => [
                            'mode' => 'AUTO',
                        ],
                    ],
                    'generationConfig' => [
                        'temperature' => 0,
                        'maxOutputTokens' => 256,
                    ],
                ])
                ->throw();

            $modelContent = $response->json('candidates.0.content');
            $calls = $this->extractCalls($modelContent);

            if ($calls === []) {
                return $fallback;
            }

            return [
                'intent' => collect($calls)->contains('name', 'get_leave_draft_context')
                    ? 'leave_draft'
                    : 'general',
                'timezone' => $timezone,
                'calls' => $calls,
                'model_content' => $this->modelContentForCalls($modelContent),
            ];
        } catch (Throwable $exception) {
            report($exception);

            return $fallback;
        }
    }

    /**
     * @param  array{
     *     calls: array<int, array{id: ?string, name: string, args: array<string, mixed>}>,
     *     model_content: ?array<string, mixed>
     * }  $plan
     * @param  array<int, array{response: array<string, mixed>}>  $executions
     * @return array<int, array<string, mixed>>
     */
    public function conversation(array $plan, array $executions): array
    {
        if ($plan['calls'] === [] || count($plan['calls']) !== count($executions)) {
            return [];
        }

        $modelContent = $plan['model_content'] ?? [
            'role' => 'model',
            'parts' => collect($plan['calls'])
                ->map(fn (array $call): array => [
                    'functionCall' => array_filter([
                        'id' => $call['id'],
                        'name' => $call['name'],
                        'args' => $call['args'],
                    ], fn (mixed $value): bool => $value !== null),
                ])
                ->all(),
        ];
        $responseParts = [];

        foreach ($plan['calls'] as $index => $call) {
            $responseParts[] = [
                'functionResponse' => array_filter([
                    'id' => $call['id'],
                    'name' => $call['name'],
                    'response' => $executions[$index]['response'],
                ], fn (mixed $value): bool => $value !== null),
            ];
        }

        return [
            $modelContent,
            ['role' => 'user', 'parts' => $responseParts],
        ];
    }

    /**
     * @return array<int, array{functionDeclarations: array<int, array<string, mixed>>}>
     */
    public function tools(): array
    {
        $dateProperties = [
            'start_date' => [
                'type' => 'string',
                'format' => 'date',
                'description' => 'Inclusive start date in YYYY-MM-DD format.',
            ],
            'end_date' => [
                'type' => 'string',
                'format' => 'date',
                'description' => 'Inclusive end date in YYYY-MM-DD format.',
            ],
        ];

        return [[
            'functionDeclarations' => [
                [
                    'name' => 'get_leave_roster',
                    'description' => 'Returns approved leave overlapping a date range, restricted to the authenticated user\'s authorized self, direct-report, or organization scope.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => $dateProperties,
                        'required' => ['start_date', 'end_date'],
                    ],
                ],
                [
                    'name' => 'get_attendance_summary',
                    'description' => 'Returns the authenticated user\'s finalized attendance totals, late days, early days, missing-punch days, and compliance for a date range.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => $dateProperties,
                        'required' => ['start_date', 'end_date'],
                    ],
                ],
                [
                    'name' => 'get_my_leave_balances',
                    'description' => 'Returns the authenticated user\'s current leave balances for one calendar year.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'year' => [
                                'type' => 'integer',
                                'description' => 'Four-digit calendar year.',
                            ],
                        ],
                        'required' => ['year'],
                    ],
                ],
                [
                    'name' => 'get_my_leave_requests',
                    'description' => 'Returns the authenticated user\'s leave requests and statuses within a date range. It never returns reasons, comments, or attachments.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            ...$dateProperties,
                            'status' => [
                                'type' => 'string',
                                'enum' => ['all', 'pending', 'approved', 'rejected', 'cancelled'],
                                'description' => 'Optional status filter represented by all when no filtering is wanted.',
                            ],
                        ],
                        'required' => ['start_date', 'end_date', 'status'],
                    ],
                ],
                [
                    'name' => 'get_holidays',
                    'description' => 'Returns active configured public holidays within a date range.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => $dateProperties,
                        'required' => ['start_date', 'end_date'],
                    ],
                ],
                [
                    'name' => 'get_leave_draft_context',
                    'description' => 'Returns the authenticated user\'s current leave types, balances, upcoming holidays, and recent request statuses needed to draft a leave request.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => new \stdClass,
                    ],
                ],
            ],
        ]];
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @return array<int, array<string, mixed>>
     */
    private function contents(array $messages, string $prompt): array
    {
        $contents = collect($messages)
            ->take(-6)
            ->map(fn (array $message): array => [
                'role' => ($message['role'] ?? null) === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => (string) ($message['content'] ?? '')]],
            ])
            ->values()
            ->all();
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $prompt]],
        ];

        return $contents;
    }

    private function request(string $apiKey): PendingRequest
    {
        $request = Http::asJson()
            ->acceptJson()
            ->withHeaders(['x-goog-api-key' => $apiKey])
            ->connectTimeout(5)
            ->timeout(15)
            ->retry(1, 200, fn (Throwable $exception): bool => $exception instanceof ConnectionException);
        $proxy = config('services.google_generative_ai.proxy');

        if (is_string($proxy) && trim($proxy) !== '') {
            $request->withOptions(['proxy' => trim($proxy)]);
        }

        return $request;
    }

    /**
     * @return array<int, array{id: ?string, name: string, args: array<string, mixed>}>
     */
    private function extractCalls(mixed $modelContent): array
    {
        if (! is_array($modelContent)) {
            return [];
        }

        return collect($modelContent['parts'] ?? [])
            ->map(fn (mixed $part): mixed => is_array($part) ? ($part['functionCall'] ?? null) : null)
            ->filter(fn (mixed $call): bool => is_array($call))
            ->filter(fn (array $call): bool => in_array($call['name'] ?? null, self::TOOL_NAMES, true))
            ->take(2)
            ->map(fn (array $call): array => [
                'id' => is_string($call['id'] ?? null) ? $call['id'] : null,
                'name' => $call['name'],
                'args' => is_array($call['args'] ?? null) ? $call['args'] : [],
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $modelContent
     * @return array<string, mixed>
     */
    private function modelContentForCalls(array $modelContent): array
    {
        $includedCalls = 0;
        $parts = collect($modelContent['parts'] ?? [])
            ->filter(function (mixed $part) use (&$includedCalls): bool {
                if (! is_array($part) || ! isset($part['functionCall'])) {
                    return true;
                }

                $name = $part['functionCall']['name'] ?? null;

                if (! in_array($name, self::TOOL_NAMES, true) || $includedCalls >= 2) {
                    return false;
                }

                $includedCalls++;

                return true;
            })
            ->values()
            ->all();

        return [
            ...$modelContent,
            'role' => 'model',
            'parts' => $parts,
        ];
    }

    /**
     * @return array{
     *     intent: 'general'|'leave_draft',
     *     timezone: string,
     *     calls: array<int, array{id: ?string, name: string, args: array<string, mixed>}>,
     *     model_content: null
     * }
     */
    private function fallbackPlan(string $prompt, Carbon $now, string $timezone): array
    {
        $normalized = mb_strtolower($prompt);
        $calls = [];
        $isLeaveDraft = preg_match(
            '/\b(draft|apply|submit|book|prepare|create)\b.*\b(leave|time off)\b|\b(leave|time off)\b.*\b(draft|application|request)\b/u',
            $normalized,
        ) === 1;

        if ($isLeaveDraft) {
            $calls[] = $this->fallbackCall('get_leave_draft_context');
        } elseif (preg_match('/\bwho(?:\'s| is| was| will be)?\b.*\b(on leave|taking leave|took leave|out on leave)\b/u', $normalized) === 1) {
            [$startDate, $endDate] = $this->fallbackRange($normalized, $now, todayOnly: true);
            $calls[] = $this->fallbackCall('get_leave_roster', compact('startDate', 'endDate'));
        } elseif (
            preg_match('/\b(how many|which|when|show|summarize|summary)\b.*\b(late|attendance|checked in|check in|early|missing punch)/u', $normalized) === 1
            || preg_match('/\b(i|my)\b.*\b(late|attendance|checked in|check in|early|missing punch)/u', $normalized) === 1
        ) {
            [$startDate, $endDate] = $this->fallbackRange($normalized, $now, todayOnly: false);
            $calls[] = $this->fallbackCall('get_attendance_summary', compact('startDate', 'endDate'));
        } elseif (preg_match('/\b(my|i)\b.*\b(balance|balances|allowance|available leave)\b/u', $normalized) === 1) {
            $calls[] = $this->fallbackCall('get_my_leave_balances', ['year' => (int) $now->year]);
        }

        return [
            'intent' => $isLeaveDraft ? 'leave_draft' : 'general',
            'timezone' => $timezone,
            'calls' => $calls,
            'model_content' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{id: string, name: string, args: array<string, mixed>}
     */
    private function fallbackCall(string $name, array $args = []): array
    {
        return [
            'id' => 'fallback-'.Str::uuid()->toString(),
            'name' => $name,
            'args' => collect($args)
                ->mapWithKeys(fn (mixed $value, string $key): array => [
                    str($key)->snake()->toString() => $value,
                ])
                ->all(),
        ];
    }

    /**
     * @return array{string, string}
     */
    private function fallbackRange(string $prompt, Carbon $now, bool $todayOnly): array
    {
        if (str_contains($prompt, 'last week')) {
            $start = $now->copy()->subWeek()->startOfWeek();

            return [$start->toDateString(), $start->copy()->endOfWeek()->toDateString()];
        }

        if (str_contains($prompt, 'this week')) {
            return [
                $now->copy()->startOfWeek()->toDateString(),
                $now->copy()->endOfWeek()->toDateString(),
            ];
        }

        if (str_contains($prompt, 'last month')) {
            $start = $now->copy()->subMonthNoOverflow()->startOfMonth();

            return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
        }

        if (str_contains($prompt, 'this month')) {
            return [
                $now->copy()->startOfMonth()->toDateString(),
                $now->copy()->endOfMonth()->toDateString(),
            ];
        }

        if ($todayOnly) {
            return [$now->toDateString(), $now->toDateString()];
        }

        return [
            $now->copy()->startOfYear()->toDateString(),
            $now->toDateString(),
        ];
    }

    private function timezone(User $actor): string
    {
        return $this->attendanceService->currentSchedule($actor)?->primarySite?->timezone
            ?? $actor->attendanceDays()->latest('work_date')->value('timezone')
            ?? config('app.timezone');
    }
}
