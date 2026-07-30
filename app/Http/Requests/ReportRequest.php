<?php

namespace App\Http\Requests;

use App\Data\ReportFilters;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class ReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user && (
            $user->hasPermission('reports.self.view')
            || $user->hasPermission('reports.team.view')
            || $user->hasPermission('reports.view')
        );
    }

    protected function prepareForValidation(): void
    {
        $now = now();
        $startDate = $this->input('start_date');
        $endDate = $this->input('end_date');

        if ((! $startDate || ! $endDate) && $this->filled('month') && $this->validMonth((string) $this->input('month'))) {
            $month = Carbon::createFromFormat('Y-m', (string) $this->input('month'));
            $startDate = $month->copy()->startOfMonth()->toDateString();
            $endDate = $month->copy()->endOfMonth()->toDateString();
        } elseif (
            (! $startDate || ! $endDate)
            && $this->filled('start_month')
            && $this->filled('end_month')
            && $this->validMonth((string) $this->input('start_month'))
            && $this->validMonth((string) $this->input('end_month'))
        ) {
            $startDate = Carbon::createFromFormat('Y-m', (string) $this->input('start_month'))->startOfMonth()->toDateString();
            $endDate = Carbon::createFromFormat('Y-m', (string) $this->input('end_month'))->endOfMonth()->toDateString();
        }

        $defaultView = $this->user()?->hasPermission('reports.team.view')
            || $this->user()?->hasPermission('reports.view')
            ? 'multi'
            : 'individual';

        $this->merge([
            'view' => $this->input('view', $defaultView),
            'section' => $this->input('section', 'overview'),
            'start_date' => $startDate ?: $now->copy()->startOfYear()->toDateString(),
            'end_date' => $endDate ?: $now->toDateString(),
            'department_ids' => $this->arrayInput('department_ids'),
            'manager_ids' => $this->arrayInput('manager_ids'),
            'role_slugs' => $this->arrayInput('role_slugs'),
            'employee_ids' => $this->arrayInput('employee_ids'),
            'leave_type_ids' => $this->arrayInput('leave_type_ids'),
            'leave_statuses' => $this->arrayInput('leave_statuses'),
            'attendance_statuses' => $this->arrayInput('attendance_statuses'),
            'site_ids' => $this->arrayInput('site_ids'),
            'employment_status' => $this->input('employment_status', 'active'),
            'page' => $this->integer('page', 1),
            'per_page' => $this->integer('per_page', 10),
            'sort' => $this->input('sort', 'name'),
            'direction' => $this->input('direction', 'asc'),
        ]);
    }

    public function rules(): array
    {
        return [
            'view' => ['required', Rule::in(['individual', 'multi'])],
            'section' => ['required', Rule::in(['overview', 'leave', 'attendance'])],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'department_ids' => ['array'],
            'department_ids.*' => ['integer', 'distinct'],
            'manager_ids' => ['array'],
            'manager_ids.*' => ['integer', 'distinct'],
            'role_slugs' => ['array'],
            'role_slugs.*' => ['string', 'distinct', 'max:100'],
            'employee_ids' => ['array', Rule::when($this->input('view') === 'individual', ['max:1'])],
            'employee_ids.*' => ['integer', 'distinct'],
            'employment_status' => ['required', Rule::in(['active', 'inactive', 'all'])],
            'leave_type_ids' => ['array'],
            'leave_type_ids.*' => ['integer', 'distinct'],
            'leave_statuses' => ['array'],
            'leave_statuses.*' => ['string', 'distinct', Rule::in(['pending', 'approved', 'rejected', 'cancelled'])],
            'attendance_statuses' => ['array'],
            'attendance_statuses.*' => ['string', 'distinct', Rule::in(['pending', 'complete', 'issues', 'excused'])],
            'site_ids' => ['array'],
            'site_ids.*' => ['integer', 'distinct'],
            'page' => ['integer', 'min:1'],
            'per_page' => ['integer', Rule::in([10, 25, 50])],
            'sort' => ['string', Rule::in(['name', 'leave_days', 'available_balance', 'attendance_compliance', 'late', 'missing'])],
            'direction' => ['string', Rule::in(['asc', 'desc'])],
            'month' => ['nullable', 'date_format:Y-m'],
            'start_month' => ['nullable', 'date_format:Y-m'],
            'end_month' => ['nullable', 'date_format:Y-m'],
        ];
    }

    public function filters(): ReportFilters
    {
        $data = $this->validated();

        return new ReportFilters(
            view: $data['view'],
            section: $data['section'],
            startDate: Carbon::parse($data['start_date'])->startOfDay(),
            endDate: Carbon::parse($data['end_date'])->startOfDay(),
            departmentIds: $this->integerArray($data['department_ids'] ?? []),
            managerIds: $this->integerArray($data['manager_ids'] ?? []),
            roleSlugs: array_values(array_unique($data['role_slugs'] ?? [])),
            employeeIds: $this->integerArray($data['employee_ids'] ?? []),
            employmentStatus: $data['employment_status'],
            leaveTypeIds: $this->integerArray($data['leave_type_ids'] ?? []),
            leaveStatuses: array_values(array_unique($data['leave_statuses'] ?? [])),
            attendanceStatuses: array_values(array_unique($data['attendance_statuses'] ?? [])),
            siteIds: $this->integerArray($data['site_ids'] ?? []),
            page: (int) $data['page'],
            perPage: (int) $data['per_page'],
            sort: $data['sort'],
            direction: $data['direction'],
        );
    }

    private function arrayInput(string $key): array
    {
        $value = $this->input($key, []);

        if ($value === null || $value === '') {
            return [];
        }

        return is_array($value) ? array_values($value) : [$value];
    }

    private function integerArray(array $values): array
    {
        return array_values(array_unique(array_map('intval', $values)));
    }

    private function validMonth(string $value): bool
    {
        return (bool) preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $value);
    }
}
