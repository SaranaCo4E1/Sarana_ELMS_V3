<?php

namespace App\Services;

use App\Data\ReportFilters;
use App\Models\User;
use Illuminate\Support\Collection;

class ReportScope
{
    public function capabilities(User $actor): array
    {
        return [
            'self' => $actor->hasPermission('reports.self.view')
                || $actor->hasPermission('reports.team.view')
                || $actor->hasPermission('reports.view'),
            'team' => $actor->hasPermission('reports.team.view'),
            'organization' => $actor->hasPermission('reports.view'),
            'can_select_individual' => $actor->hasPermission('reports.team.view')
                || $actor->hasPermission('reports.view'),
        ];
    }

    public function baseUsers(User $actor, string $view): Collection
    {
        $capabilities = $this->capabilities($actor);

        if ($view === 'multi' && ! $capabilities['team'] && ! $capabilities['organization']) {
            abort(403);
        }

        return User::query()
            ->with(['department:id,name', 'manager:id,name'])
            ->select(['id', 'department_id', 'manager_id', 'name', 'employee_code', 'role', 'is_active'])
            ->when(
                ! $capabilities['organization'] && $view === 'multi',
                fn ($query) => $query->where('manager_id', $actor->id),
            )
            ->when(
                ! $capabilities['organization'] && $view === 'individual',
                fn ($query) => $capabilities['team']
                    ? $query->where(fn ($users) => $users->whereKey($actor->id)->orWhere('manager_id', $actor->id))
                    : $query->whereKey($actor->id),
            )
            ->orderBy('name')
            ->get();
    }

    public function resolve(User $actor, ReportFilters $filters): array
    {
        $base = $this->baseUsers($actor, $filters->view);
        $this->assertAuthorizedSelections($base, $filters);

        if ($filters->view === 'individual') {
            $targetId = $filters->employeeIds[0] ?? $actor->id;
            $target = $base->firstWhere('id', $targetId);
            abort_unless($target, 403);

            return [
                'base' => $base,
                'users' => collect([$target]),
                'capabilities' => $this->capabilities($actor),
                'scope' => 'individual',
            ];
        }

        $users = $base
            ->when(
                $filters->employmentStatus !== 'all',
                fn (Collection $items) => $items->where('is_active', $filters->employmentStatus === 'active'),
            )
            ->when($filters->departmentIds, fn (Collection $items) => $items->whereIn('department_id', $filters->departmentIds))
            ->when($filters->managerIds, fn (Collection $items) => $items->whereIn('manager_id', $filters->managerIds))
            ->when($filters->roleSlugs, fn (Collection $items) => $items->whereIn('role', $filters->roleSlugs))
            ->when($filters->employeeIds, fn (Collection $items) => $items->whereIn('id', $filters->employeeIds))
            ->values();

        return [
            'base' => $base,
            'users' => $users,
            'capabilities' => $this->capabilities($actor),
            'scope' => $this->capabilities($actor)['organization'] ? 'organization' : 'team',
        ];
    }

    private function assertAuthorizedSelections(Collection $base, ReportFilters $filters): void
    {
        $this->assertSubset($filters->employeeIds, $base->pluck('id'));
        $this->assertSubset($filters->departmentIds, $base->pluck('department_id')->filter());
        $this->assertSubset($filters->managerIds, $base->pluck('manager_id')->filter());
        $this->assertSubset($filters->roleSlugs, $base->pluck('role')->filter());
    }

    private function assertSubset(array $requested, Collection $allowed): void
    {
        if (! $requested) {
            return;
        }

        $allowedValues = $allowed->unique()->values()->all();
        abort_if(collect($requested)->contains(fn ($value) => ! in_array($value, $allowedValues, true)), 403);
    }
}
