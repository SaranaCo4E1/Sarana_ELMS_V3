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
        public array $attendanceIssues,
        public int $page,
        public int $perPage,
        public string $sort,
        public string $direction,
        public string $leaveSort,
        public string $leaveDirection,
        public string $attendanceSort,
        public string $attendanceDirection,
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
            'attendance_issues' => $this->attendanceIssues,
            'page' => $this->page,
            'per_page' => $this->perPage,
            'sort' => $this->sort,
            'direction' => $this->direction,
            'leave_sort' => $this->leaveSort,
            'leave_direction' => $this->leaveDirection,
            'attendance_sort' => $this->attendanceSort,
            'attendance_direction' => $this->attendanceDirection,
        ];
    }
}
