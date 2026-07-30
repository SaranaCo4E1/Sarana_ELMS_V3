<?php

namespace App\Services\Ai;

use App\Models\Department;
use App\Models\User;

class AiOrganizationContext
{
    public function build(User $actor): string
    {
        $departments = Department::query()
            ->with('manager:id,name,is_active')
            ->withCount([
                'users as active_employee_count' => fn ($query) => $query->where('is_active', true),
                'users as active_staff_count' => fn ($query) => $query
                    ->where('is_active', true)
                    ->where('role', 'staff'),
            ])
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'manager_id']);

        $actor->loadMissing('manager:id,name,manager_id');
        $teammates = $actor->manager_id
            ? User::query()
                ->where('manager_id', $actor->manager_id)
                ->whereKeyNot($actor->id)
                ->where('is_active', true)
                ->orderBy('name')
                ->pluck('name')
            : collect();
        $managementChain = $this->managementChain($actor);

        $departmentLines = $departments
            ->map(fn (Department $department): string => sprintf(
                '- %s (%s): manager %s; %d active employees, including %d employees with the staff role',
                $department->name,
                $department->code,
                $department->manager
                    ? $department->manager->name.($department->manager->is_active ? '' : ' (inactive)')
                    : 'Not assigned',
                $department->active_employee_count,
                $department->active_staff_count,
            ))
            ->implode("\n");

        return implode("\n", [
            'Current organization snapshot:',
            '- Snapshot generated at: '.now()->toIso8601String(),
            '- Active department count: '.$departments->count(),
            $departmentLines ?: '- No active departments are configured.',
            '- Current user\'s manager: '.($actor->manager?->name ?? 'Not assigned'),
            '- Current user\'s teammates (active employees with the same manager): '
                .($teammates->isEmpty() ? 'None' : $teammates->implode(', ')),
            '- Current user\'s management chain (direct manager first): '
                .($managementChain === [] ? 'None' : implode(' -> ', $managementChain)),
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function managementChain(User $actor): array
    {
        $chain = [];
        $visited = [$actor->id => true];
        $manager = $actor->manager;

        while ($manager instanceof User && count($chain) < 5 && ! isset($visited[$manager->id])) {
            $chain[] = $manager->name;
            $visited[$manager->id] = true;
            $manager = $manager->manager()->select(['id', 'name', 'manager_id'])->first();
        }

        return $chain;
    }
}
