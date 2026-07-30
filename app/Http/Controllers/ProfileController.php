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
            'profile' => $request->user()->load(['department', 'manager', 'profile']),
            'telegramConnected' => $request->user()->hasTelegramLinked(),
            'telegramConfigured' => (bool) config('services.telegram.bot_username'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', Rule::in(['Male', 'Female'])],
            'nationality' => ['nullable', 'string', 'max:100'],
            'national_id_number' => ['nullable', 'string', 'max:50'],
            'join_date' => ['nullable', 'date'],
            'employment_type' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:2000'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:20'],
            'bank_account_number' => ['nullable', 'string', 'max:50'],
            'bank_name' => ['nullable', 'string', 'max:100'],
        ]);

        $profile = $user->profile()->firstOrNew(['user_id' => $user->id]);
        $profileFields = array_diff(array_keys($data), ['name', 'email']);
        $before = [
            'name' => $user->name,
            'email' => $user->email,
            ...$profile->only($profileFields),
        ];

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
        ]);

        unset($data['name'], $data['email']);

        $profile->fill($data)->save();
        Audit::recordChange($request, 'profile.updated', $user, $before, [
            'name' => $user->name,
            'email' => $user->email,
            ...$profile->only($profileFields),
        ]);

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
        Audit::record($request, 'profile.password.updated', $user, [
            'security_event' => true,
            'credentials_revoked' => false,
        ]);

        return back()->with('success', 'Password updated.');
    }

    public function updateTwoFactor(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'current_password' => ['required', 'current_password'],
        ]);

        $user = $request->user();
        $before = ['two_factor_enabled' => (bool) $user->two_factor_enabled];
        $user->forceFill([
            'two_factor_enabled' => $data['enabled'],
            'two_factor_code' => null,
            'two_factor_expires_at' => null,
        ])->save();

        Audit::recordChange(
            $request,
            $data['enabled'] ? 'profile.two_factor.enabled' : 'profile.two_factor.disabled',
            $user,
            $before,
            ['two_factor_enabled' => (bool) $user->two_factor_enabled],
            ['security_event' => true]
        );

        return back()->with('success', $data['enabled'] ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
    }
}
