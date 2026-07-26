<?php

namespace App\Http\Controllers;

use App\Models\SupportMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class SupportController extends Controller
{
    /**
     * Show the public Help Desk / Support form.
     */
    public function index(): Response
    {
        return Inertia::render('Support');
    }

    /**
     * Show submitted support tickets to HR administrators.
     */
    public function tickets(): Response
    {
        $tickets = SupportMessage::query()
            ->with('user:id,name,email')
            ->latest()
            ->get();

        return Inertia::render('SupportTickets', [
            'tickets' => $tickets,
            'stats' => [
                'total' => $tickets->count(),
                'today' => $tickets->where('created_at', '>=', now()->startOfDay())->count(),
                'registered' => $tickets->whereNotNull('user_id')->count(),
                'guest' => $tickets->whereNull('user_id')->count(),
            ],
        ]);
    }

    /**
     * Persist a new support desk submission.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        SupportMessage::create([
            'user_id' => Auth::id(),
            'name' => $validated['name'],
            'email' => $validated['email'],
            'subject' => $validated['subject'],
            'message' => $validated['message'],
        ]);

        return back()->with('success', 'Thank you! We have received your inquiry and our support team will contact you shortly.');
    }
}
