<?php

namespace App\Http\Middleware;

use App\Models\SystemNotification;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user?->load('department'),
            ],
            'notifications' => [
                'items' => fn () => $user
                    ? SystemNotification::query()
                        ->where('user_id', $user->id)
                        ->latest()
                        ->limit(8)
                        ->get(['id', 'type', 'title', 'body', 'action_url', 'read_at', 'created_at'])
                    : [],
                'unread_count' => fn () => $user
                    ? SystemNotification::query()
                        ->where('user_id', $user->id)
                        ->whereNull('read_at')
                        ->count()
                    : 0,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
