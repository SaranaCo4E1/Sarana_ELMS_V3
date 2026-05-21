<?php

namespace App\Http\Controllers;

use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Profile', [
            'profile' => $request->user()->load(['department', 'manager']),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'work_location' => ['nullable', 'string', 'max:120'],
            'employment_type' => ['nullable', 'string', 'max:80'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:50'],
            'bio' => ['nullable', 'string', 'max:1000'],
        ]);

        $user->update($data);
        Audit::record($request, 'profile.updated', $user);

        return back()->with('success', 'Profile updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', 'min:8'],
        ]);

        $user->forceFill(['password' => Hash::make($data['password'])])->save();
        Audit::record($request, 'profile.password.updated', $user);

        return back()->with('success', 'Password updated.');
    }

    public function updateTwoFactor(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'current_password' => ['required', 'current_password'],
        ]);

        $user = $request->user();
        $user->forceFill([
            'two_factor_enabled' => $data['enabled'],
            'two_factor_code' => null,
            'two_factor_expires_at' => null,
        ])->save();

        Audit::record($request, $data['enabled'] ? 'profile.two_factor.enabled' : 'profile.two_factor.disabled', $user);

        return back()->with('success', $data['enabled'] ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
    }
}
