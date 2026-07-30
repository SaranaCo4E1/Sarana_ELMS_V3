<?php

namespace App\Data;

use Illuminate\Support\Carbon;

final readonly class ReportFilters
{
    public function __construct(
        public string $view,
        public string $section,
        public Carbon $startDate,
        public Carbon $endDate,
        public array $departmentIds,
        public array $managerIds,
        public array $roleSlugs,
        public array $employeeIds,
        public string $employmentStatus,
        public array $leaveTypeIds,
        public array $leaveStatuses,
        public array $attendanceStatuses,
        public array $siteIds,
        public int $page,
        public int $perPage,
        public string $sort,
        public string $direction,
    ) {}

    public function toArray(): array
    {
        return [
            'view' => $this->view,
            'section' => $this->section,
            'start_date' => $this->startDate->toDateString(),
            'end_date' => $this->endDate->toDateString(),
            'department_ids' => $this->departmentIds,
            'manager_ids' => $this->managerIds,
            'role_slugs' => $this->roleSlugs,
            'employee_ids' => $this->employeeIds,
            'employment_status' => $this->employmentStatus,
            'leave_type_ids' => $this->leaveTypeIds,
            'leave_statuses' => $this->leaveStatuses,
            'attendance_statuses' => $this->attendanceStatuses,
            'site_ids' => $this->siteIds,
            'page' => $this->page,
            'per_page' => $this->perPage,
            'sort' => $this->sort,
            'direction' => $this->direction,
        ];
    }
}
