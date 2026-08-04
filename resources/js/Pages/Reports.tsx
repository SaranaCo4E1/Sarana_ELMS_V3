import { router } from '@inertiajs/react';
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarRange,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Filter,
  RefreshCw,
  UserRound,
  Users,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import AppLayout from '../Layouts/AppLayout';

type IdOption = { id: number; name: string };
type EmployeeOption = {
  id: number;
  name: string;
  employee_code?: string | null;
  department_id?: number | null;
  manager_id?: number | null;
  role: string;
  is_active: boolean;
};
type SelectOption = { value: string; label: string };
type PeriodPreset = 'month' | '30' | 'quarter' | 'year';
type DrillDown = { filters: Partial<Filters>; target: string };
type TrendRow = {
  key: string;
  label: string;
  values: Record<string, number>;
  compliance?: number;
};
type Paged<T> = {
  data: T[];
  page: number;
  per_page: number;
  total: number;
  last_page: number;
};
type LeaveRequestRow = {
  id: number;
  user_id: number;
  name: string;
  employee_code?: string | null;
  department: string;
  leave_type: string;
  starts_at: string;
  ends_at: string;
  requested_days: number;
  days_in_period: number;
  status: string;
  reason?: string | null;
  approver?: string | null;
  manager_comment?: string | null;
};
type AttendanceIssueDay = {
  id: number;
  user_id: number;
  name: string;
  department: string;
  date: string;
  issues: string[];
  issue_count: number;
  flagged_events: number;
  unresolved_flags: number;
  slots: { type: string; expected_at?: string | null; actual_at?: string | null; status: string }[];
};
type DetailRow = {
  id: number;
  name: string;
  employee_code?: string | null;
  department: string;
  role: string;
  leave_days: number;
  used_balance: number;
  available_balance: number;
  attendance_compliance: number;
  late: number;
  early: number;
  missing: number;
};
type Filters = {
  view: 'individual' | 'multi';
  section: 'overview' | 'leave' | 'attendance';
  start_date: string;
  end_date: string;
  department_ids: number[];
  manager_ids: number[];
  role_slugs: string[];
  employee_ids: number[];
  employment_status: 'active' | 'inactive' | 'all';
  leave_type_ids: number[];
  leave_statuses: string[];
  attendance_statuses: string[];
  attendance_issues: string[];
  page: number;
  per_page: number;
  sort: string;
  direction: 'asc' | 'desc';
  leave_sort: string;
  leave_direction: 'asc' | 'desc';
  attendance_sort: string;
  attendance_direction: 'asc' | 'desc';
};
type Props = {
  capabilities: {
    self: boolean;
    team: boolean;
    organization: boolean;
    can_select_individual: boolean;
  };
  scope: 'individual' | 'team' | 'organization';
  filters: Filters;
  filterOptions: {
    employees: EmployeeOption[];
    departments: IdOption[];
    managers: IdOption[];
    roles: string[];
    leave_types: (IdOption & { code: string; paid: boolean })[];
  };
  summary: {
    employees: number;
    approved_leave_days: number;
    pending_leave_days: number;
    available_balance: number;
    attendance_compliance: number;
    late: number;
    early: number;
    missing: number;
    unresolved_flags: number;
  };
  leave: {
    balance_year: number;
    trend: TrendRow[];
    status: { name: string; count: number; days: number }[];
    types: { name: string; count: number; days: number }[];
    balances: { name: string; entitlement: number; used: number; pending: number; available: number; utilization: number }[];
    employee_balances: { user_id: number; name: string; department: string; used: number; available: number; utilization: number }[];
    rankings: { user_id: number; name: string; department: string; days: number; requests: number; primary_type?: string | null }[];
    concurrency_distribution: { name: string; days: number }[];
    requests: Paged<LeaveRequestRow>;
    insights: {
      top_employee?: { user_id: number; name: string; department: string; days: number; requests: number; primary_type?: string | null } | null;
      top_type?: { name: string; days: number } | null;
      peak_absence?: { date: string; employees: number } | null;
    };
  };
  attendance: {
    trend: TrendRow[];
    heatmap: { date: string; records: number; issues: number }[];
    issue_mix: { name: string; value: number }[];
    employees: { user_id: number; name: string; department: string; compliance: number; complete: number; issues: number; late: number; early: number; missing: number; records: number }[];
    departments: { name: string; compliance: number; late: number; early: number; missing: number }[];
    issue_days: Paged<AttendanceIssueDay>;
    insights: {
      top_issue_employee?: { user_id: number; name: string; department: string; compliance: number; issues: number; late: number; early: number; missing: number } | null;
      peak_issue_date?: { date: string; records: number; issues: number } | null;
      lowest_department?: { name: string; compliance: number; late: number; early: number; missing: number } | null;
    };
  };
  details: {
    data: DetailRow[];
    page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

const LEAVE_STATUSES: SelectOption[] = ['approved', 'pending', 'rejected', 'cancelled']
  .map((value) => ({ value, label: titleCase(value) }));
const ATTENDANCE_STATUSES: SelectOption[] = ['complete', 'issues']
  .map((value) => ({ value, label: titleCase(value) }));
const ATTENDANCE_ISSUES: SelectOption[] = [
  { value: 'late', label: 'Late in' },
  { value: 'early', label: 'Early out' },
  { value: 'missing', label: 'Missing punch' },
];
const PERIOD_PRESETS: [PeriodPreset, string][] = [
  ['month', 'This month'],
  ['30', 'Last 30 days'],
  ['quarter', 'This quarter'],
  ['year', 'This year'],
];

export default function Reports(props: Props) {
  const { capabilities, filterOptions, filters, summary, leave, attendance, details } = props;
  const [draft, setDraft] = useState<Filters>(filters);
  const [selectedPeriodPreset, setSelectedPeriodPreset] = useState<PeriodPreset | null>(
    () => matchingPeriodPreset(filters),
  );
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setDraft(filters), [filters]);
  useEffect(() => {
    const start = () => setLoading(true);
    const finish = () => setLoading(false);
    const removeStart = router.on('start', start);
    const removeFinish = router.on('finish', finish);
    return () => {
      removeStart();
      removeFinish();
    };
  }, []);

  const availableEmployees = filterOptions.employees;

  const filteredEmployees = useMemo(() => {
    return availableEmployees.filter((employee) => {
      const active = draft.employment_status === 'all'
        || employee.is_active === (draft.employment_status === 'active');
      const department = !draft.department_ids.length || (
        employee.department_id != null && draft.department_ids.includes(employee.department_id)
      );
      const manager = !draft.manager_ids.length || (
        employee.manager_id != null && draft.manager_ids.includes(employee.manager_id)
      );
      const role = !draft.role_slugs.length || draft.role_slugs.includes(employee.role);
      return active && department && manager && role;
    });
  }, [availableEmployees, draft.department_ids, draft.employment_status, draft.manager_ids, draft.role_slugs]);

  const managerOptions = useMemo(() => {
    const possible = availableEmployees.filter((employee) => {
      const active = draft.employment_status === 'all'
        || employee.is_active === (draft.employment_status === 'active');
      return active && (!draft.department_ids.length || (
        employee.department_id != null && draft.department_ids.includes(employee.department_id)
      ));
    });
    const ids = new Set(possible.map((employee) => employee.manager_id).filter(Boolean));
    return filterOptions.managers.filter((manager) => ids.has(manager.id));
  }, [availableEmployees, draft.department_ids, draft.employment_status, filterOptions.managers]);

  const activePeriodPreset = selectedPeriodPreset && periodMatches(draft, selectedPeriodPreset)
    ? selectedPeriodPreset
    : matchingPeriodPreset(draft);

  const updateDraft = (patch: Partial<Filters>) => {
    const next = { ...draft, ...patch, page: 1 };
    const people = availableEmployees.filter((employee) => {
      const active = next.employment_status === 'all'
        || employee.is_active === (next.employment_status === 'active');
      const department = !next.department_ids.length || (
        employee.department_id != null && next.department_ids.includes(employee.department_id)
      );
      const manager = !next.manager_ids.length || (
        employee.manager_id != null && next.manager_ids.includes(employee.manager_id)
      );
      const role = !next.role_slugs.length || next.role_slugs.includes(employee.role);
      return active && department && manager && role;
    });
    const validEmployeeIds = new Set(people.map((employee) => employee.id));
    next.employee_ids = next.employee_ids.filter((id) => validEmployeeIds.has(id));
    const validManagerIds = new Set(people.map((employee) => employee.manager_id).filter(Boolean));
    next.manager_ids = next.manager_ids.filter((id) => validManagerIds.has(id));
    setDraft(next);
    if (patch.start_date !== undefined || patch.end_date !== undefined) {
      setSelectedPeriodPreset(null);
    }
  };

  const apply = (overrides: Partial<Filters> = {}) => {
    router.get('/reports', queryPayload({ ...draft, ...overrides }), {
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };

  const applyPeriod = (preset: PeriodPreset) => {
    const next = { ...draft, ...periodFor(preset), page: 1 };
    setDraft(next);
    setSelectedPeriodPreset(preset);
    router.get('/reports', queryPayload(next), {
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };

  const reset = () => {
    const defaultPeriod = periodFor('30');
    const clean: Filters = {
      ...filters,
      view: capabilities.team || capabilities.organization ? 'multi' : 'individual',
      section: filters.section,
      ...defaultPeriod,
      department_ids: [],
      manager_ids: [],
      role_slugs: [],
      employee_ids: [],
      employment_status: 'active',
      leave_type_ids: [],
      leave_statuses: [],
      attendance_statuses: capabilities.team || capabilities.organization ? ['issues'] : [],
      attendance_issues: [],
      page: 1,
      sort: 'name',
      direction: 'asc',
      leave_sort: 'starts_at',
      leave_direction: 'desc',
      attendance_sort: 'date',
      attendance_direction: 'desc',
    };
    setDraft(clean);
    setSelectedPeriodPreset('30');
    router.get('/reports', queryPayload(clean), { preserveScroll: true, replace: true });
  };

  const selectSection = (section: Filters['section']) => {
    const metricReset = section === 'leave'
      ? { attendance_statuses: [], attendance_issues: [] }
      : section === 'attendance'
        ? { leave_type_ids: [], leave_statuses: [], attendance_statuses: draft.view === 'multi' ? ['issues'] : [] }
        : { leave_type_ids: [], leave_statuses: [], attendance_statuses: [], attendance_issues: [] };
    const next = { ...draft, ...metricReset, section, page: 1 };
    setDraft(next);
    router.get('/reports', queryPayload(next), {
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };

  const exportUrl = (type: 'leave' | 'attendance') => {
    const params = queryString(filters);
    return `/reports/export/${type}?${params}`;
  };

  const focusEmployee = (userId: number) => {
    apply({ employee_ids: [userId], page: 1 });
  };

  const drillDown = ({ filters: patch, target }: DrillDown) => {
    const next = { ...filters, ...patch, page: 1 };
    setDraft(next);
    router.get('/reports', queryPayload(next), {
      preserveState: true,
      replace: true,
      onSuccess: () => window.setTimeout(() => {
        const destination = document.getElementById(target);
        destination?.querySelector<HTMLButtonElement>(
          ':scope > button[aria-expanded="false"], :scope > div:first-child > button[aria-expanded="false"]',
        )?.click();
        destination?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
              <FileText size={15} />
              {props.scope === 'organization' ? 'Organization reporting' : props.scope === 'team' ? 'Direct-report reporting' : 'Personal reporting'}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Reports</h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Leave and attendance patterns for {formatDate(filters.start_date)} through {formatDate(filters.end_date)}.
            </p>
          </div>
          <div className="flex gap-2">
            {filters.section !== 'attendance' && (
              <a href={exportUrl('leave')} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm hover:border-orange-200 hover:text-orange-700">
                <Download size={14} /> Leave CSV
              </a>
            )}
            {filters.section !== 'leave' && (
              <a href={exportUrl('attendance')} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm hover:border-orange-200 hover:text-orange-700">
                <Download size={14} /> Attendance CSV
              </a>
            )}
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-sm">
          {(['overview', 'leave', 'attendance'] as const).map((section) => (
            <button key={section} type="button" onClick={() => selectSection(section)} className={sectionButton(filters.section === section)}>
              {section === 'overview' ? <Activity size={15} /> : section === 'leave' ? <CalendarRange size={15} /> : <Clock3 size={15} />}
              {titleCase(section)}
            </button>
          ))}
        </nav>

        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-neutral-50/70 ${filtersOpen ? 'border-b border-neutral-100' : ''}`}>
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700"><Filter size={16} /></span>
              <span>
                <span className="block text-sm font-semibold text-neutral-900">Filter report</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{formatDate(filters.start_date)} – {formatDate(filters.end_date)} · {summary.employees} employee{summary.employees === 1 ? '' : 's'}</span>
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs font-medium text-neutral-400">
              {loading ? 'Updating…' : filtersOpen ? 'Hide' : 'Edit'}
              <ChevronDown size={17} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {filtersOpen && <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              {PERIOD_PRESETS.map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={activePeriodPreset === preset}
                  onClick={() => applyPeriod(preset)}
                  className={periodButton(activePeriodPreset === preset)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Start date" icon={<CalendarRange size={14} />}>
                <DatePicker
                  selected={parseDateOnly(draft.start_date)}
                  onChange={(date: Date | null) => date && updateDraft({ start_date: localDate(date) })}
                  dateFormat="MMM d, yyyy"
                  className={`${inputClass} cursor-pointer`}
                  autoComplete="off"
                />
              </FilterField>
              <FilterField label="End date" icon={<CalendarRange size={14} />}>
                <DatePicker
                  selected={parseDateOnly(draft.end_date)}
                  onChange={(date: Date | null) => date && updateDraft({ end_date: localDate(date) })}
                  minDate={parseDateOnly(draft.start_date)}
                  dateFormat="MMM d, yyyy"
                  className={`${inputClass} cursor-pointer`}
                  autoComplete="off"
                />
              </FilterField>

              {capabilities.can_select_individual && (
                <>
                  <FilterField label="Employment" icon={<Users size={14} />}>
                    <select value={draft.employment_status} onChange={(event) => updateDraft({ employment_status: event.target.value as Filters['employment_status'] })} className={inputClass}>
                      <option value="active">Active employees</option>
                      <option value="inactive">Inactive employees</option>
                      <option value="all">All employees</option>
                    </select>
                  </FilterField>
                  <FilterField label="Departments" icon={<Building2 size={14} />}>
                    <MultiSelect
                      options={filterOptions.departments.map(idSelectOption)}
                      values={draft.department_ids.map(String)}
                      onChange={(values) => updateDraft({ department_ids: values.map(Number) })}
                      placeholder="All departments"
                    />
                  </FilterField>
                  <FilterField label="Managers" icon={<UserRound size={14} />}>
                    <MultiSelect
                      options={managerOptions.map(idSelectOption)}
                      values={draft.manager_ids.map(String)}
                      onChange={(values) => updateDraft({ manager_ids: values.map(Number) })}
                      placeholder="All managers"
                    />
                  </FilterField>
                  <FilterField label="Roles" icon={<Users size={14} />}>
                    <MultiSelect
                      options={filterOptions.roles.map((role) => ({ value: role, label: titleCase(role) }))}
                      values={draft.role_slugs}
                      onChange={(values) => updateDraft({ role_slugs: values })}
                      placeholder="All roles"
                    />
                  </FilterField>
                  <FilterField label="Employees" icon={<Users size={14} />}>
                    <MultiSelect
                      options={filteredEmployees.map(employeeSelectOption)}
                      values={draft.employee_ids.map(String)}
                      onChange={(values) => updateDraft({ employee_ids: values.map(Number) })}
                      placeholder="All employees"
                    />
                  </FilterField>
                </>
              )}

              {draft.section === 'leave' && (
                <>
                  <FilterField label="Leave types" icon={<Filter size={14} />}>
                    <MultiSelect
                      options={filterOptions.leave_types.map(idSelectOption)}
                      values={draft.leave_type_ids.map(String)}
                      onChange={(values) => updateDraft({ leave_type_ids: values.map(Number) })}
                      placeholder="All leave types"
                    />
                  </FilterField>
                  <FilterField label="Leave statuses" icon={<Filter size={14} />}>
                    <MultiSelect options={LEAVE_STATUSES} values={draft.leave_statuses} onChange={(values) => updateDraft({ leave_statuses: values })} placeholder="All statuses" />
                  </FilterField>
                </>
              )}
              {draft.section === 'attendance' && (
                <>
                  <FilterField label="Attendance statuses" icon={<Clock3 size={14} />}>
                    <MultiSelect options={ATTENDANCE_STATUSES} values={draft.attendance_statuses} onChange={(values) => updateDraft({ attendance_statuses: values })} placeholder="All statuses" />
                  </FilterField>
                  <FilterField label="Attendance issues" icon={<Filter size={14} />}>
                    <MultiSelect options={ATTENDANCE_ISSUES} values={draft.attendance_issues} onChange={(values) => updateDraft({ attendance_issues: values })} placeholder="All issue types" />
                  </FilterField>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
              <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">
                <RefreshCw size={15} /> Reset
              </button>
              <button type="button" onClick={() => apply()} disabled={loading || draft.start_date > draft.end_date} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Filter size={15} /> Apply filters
              </button>
            </div>
          </div>}
        </section>

        {filters.section === 'overview' && (
          <>
            <SummaryReport summary={summary} onDrillDown={drillDown} />
            <EmployeeSummaryTable details={details} filters={filters} onNavigate={apply} onFocus={focusEmployee} />
          </>
        )}

        {filters.section === 'leave' && (
          <LeaveRequestTable filters={filters} requests={leave.requests} onNavigate={apply} onFocus={focusEmployee} />
        )}

        {filters.section === 'attendance' && (
          <AttendanceIssueTable filters={filters} issueDays={attendance.issue_days} onNavigate={apply} onFocus={focusEmployee} />
        )}
      </div>
    </AppLayout>
  );
}

function MultiSelect({ options, values, onChange, placeholder }: { options: SelectOption[]; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  const selected = options.filter((option) => values.includes(option.value));
  return (
    <Select<SelectOption, true>
      isMulti
      options={options}
      value={selected}
      onChange={(items) => onChange(items.map((item) => item.value))}
      placeholder={placeholder}
      closeMenuOnSelect={false}
      styles={selectStyles}
    />
  );
}

function FilterField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">{icon}{label}</span>
      {children}
    </label>
  );
}

function SummaryReport({ summary, onDrillDown }: {
  summary: Props['summary'];
  onDrillDown: (drillDown: DrillDown) => void;
}) {
  const [open, setOpen] = useState(true);
  const rows = [
    { label: 'Employees included', display: String(summary.employees), drillDown: { filters: { section: 'overview' as const, leave_type_ids: [], leave_statuses: [], attendance_statuses: [], attendance_issues: [] }, target: 'employee-report' } },
    { label: 'Approved leave', display: `${summary.approved_leave_days} days`, drillDown: { filters: { section: 'leave' as const, leave_statuses: ['approved'], attendance_statuses: [], attendance_issues: [] }, target: 'leave-request-report' } },
    { label: 'Pending leave', display: `${summary.pending_leave_days} days`, drillDown: { filters: { section: 'leave' as const, leave_statuses: ['pending'], attendance_statuses: [], attendance_issues: [] }, target: 'leave-request-report' } },
    { label: 'Available leave balance', display: `${summary.available_balance} days`, drillDown: { filters: { section: 'leave' as const, leave_statuses: [], attendance_statuses: [], attendance_issues: [] }, target: 'leave-request-report' } },
    { label: 'Attendance compliance', display: `${summary.attendance_compliance}%`, drillDown: { filters: { section: 'attendance' as const, leave_type_ids: [], leave_statuses: [], attendance_statuses: [], attendance_issues: [] }, target: 'attendance-issue-report' } },
    { label: 'Late-in days', display: String(summary.late), drillDown: { filters: { section: 'attendance' as const, leave_type_ids: [], leave_statuses: [], attendance_statuses: ['issues'], attendance_issues: ['late'] }, target: 'attendance-issue-report' } },
    { label: 'Early-out days', display: String(summary.early), drillDown: { filters: { section: 'attendance' as const, leave_type_ids: [], leave_statuses: [], attendance_statuses: ['issues'], attendance_issues: ['early'] }, target: 'attendance-issue-report' } },
    { label: 'Missing-attendance days', display: String(summary.missing), drillDown: { filters: { section: 'attendance' as const, leave_type_ids: [], leave_statuses: [], attendance_statuses: ['issues'], attendance_issues: ['missing'] }, target: 'attendance-issue-report' } },
  ];
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-neutral-50/70 ${open ? 'border-b border-neutral-100' : ''}`}
      >
        <span>
          <span className="block font-semibold text-neutral-900">Report summary</span>
          <span className="mt-1 block text-xs leading-5 text-neutral-500">Key totals for the selected period and employee scope.</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid gap-px bg-neutral-100 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <button key={row.label} type="button" onClick={() => onDrillDown(row.drillDown)} className="group bg-white px-5 py-4 text-left transition hover:bg-orange-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
              <span className="block text-xs font-medium text-neutral-500">{row.label}</span>
              <span className="mt-1.5 flex items-center justify-between gap-3 text-xl font-semibold tracking-tight text-neutral-900"><span>{row.display}</span><ArrowRight size={16} className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-orange-600" /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportTable({ id, title, description, children }: { id?: string; title: string; description: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <section id={id} className="min-w-0 scroll-mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-neutral-50/70 ${open ? 'border-b border-neutral-100' : ''}`}>
        <span>
          <span className="block font-semibold text-neutral-900">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-neutral-500">{description}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="overflow-x-auto">{children}</div>}
    </section>
  );
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return <tr><td colSpan={columns} className="px-5 py-10 text-center text-sm text-neutral-400">{message}</td></tr>;
}

function EmployeeSummaryTable({ details, filters, onNavigate, onFocus }: {
  details: Props['details'];
  filters: Filters;
  onNavigate: (patch: Partial<Filters>) => void;
  onFocus: (userId: number) => void;
}) {
  const sort = (key: string) => onNavigate({
    sort: key,
    direction: filters.sort !== key ? 'desc' : filters.direction === 'asc' ? 'desc' : 'asc',
    page: 1,
  });
  return (
    <ReportTable id="employee-report" title="Employee report" description={`${details.total} employee${details.total === 1 ? '' : 's'} in the selected report scope.`}>
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><SortableHeader label="Employee" sortKey="name" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Department" sortKey="department" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Leave days" sortKey="leave_days" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Balance used" sortKey="used_balance" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Available" sortKey="available_balance" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Attendance Compliance" sortKey="attendance_compliance" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Late" sortKey="late" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Early" sortKey="early" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><SortableHeader label="Missing" sortKey="missing" activeSort={filters.sort} direction={filters.direction} onSort={sort} /><th className="px-4 py-3"><span className="sr-only">Action</span></th></tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {details.data.map((row) => <tr key={row.id} className="hover:bg-neutral-50/70"><td className="px-4 py-3.5"><div className="font-semibold text-neutral-800">{row.name}</div><div className="mt-0.5 text-xs text-neutral-400">{row.employee_code ?? 'No code'} · {titleCase(row.role)}</div></td><td className="px-4 py-3.5">{row.department}</td><td className="px-4 py-3.5 font-semibold">{row.leave_days}</td><td className="px-4 py-3.5">{row.used_balance}</td><td className="px-4 py-3.5">{row.available_balance}</td><td className="px-4 py-3.5 font-semibold">{row.attendance_compliance}%</td><td className="px-4 py-3.5">{row.late}</td><td className="px-4 py-3.5">{row.early}</td><td className="px-4 py-3.5">{row.missing}</td><td className="px-4 py-3.5 text-right"><button type="button" onClick={() => onFocus(row.id)} className="text-xs font-semibold text-orange-700">Focus</button></td></tr>)}
          {!details.data.length && <EmptyRow columns={10} message="No employees match the selected filters." />}
        </tbody>
      </table>
      <Pagination rows={details} onNavigate={onNavigate} />
    </ReportTable>
  );
}

function LeaveBalanceTable({ rows, year }: { rows: Props['leave']['balances']; year: number }) {
  return <ReportTable id="leave-balance-report" title="Leave balance report" description={`Entitlement and utilization by leave type for ${year}.`}><ReportDataTable rows={rows} rowKey={(row) => row.name} minWidth="620px" empty="No leave balances are available." columns={[
    { key: 'name', label: 'Leave type', value: (row) => row.name, render: (row) => <span className="font-medium text-neutral-800">{row.name}</span> },
    { key: 'entitlement', label: 'Entitlement', value: (row) => row.entitlement, align: 'right' },
    { key: 'used', label: 'Used', value: (row) => row.used, align: 'right' },
    { key: 'pending', label: 'Pending', value: (row) => row.pending, align: 'right' },
    { key: 'available', label: 'Available', value: (row) => row.available, align: 'right' },
    { key: 'utilization', label: 'Utilization', value: (row) => row.utilization, render: (row) => <span className="font-semibold">{row.utilization}%</span>, align: 'right' },
  ]} /></ReportTable>;
}

function LeaveTypeTable({ rows }: { rows: Props['leave']['types'] }) {
  return <ReportTable title="Leave usage by type" description="Request count and working leave days by leave type."><ReportDataTable rows={rows} rowKey={(row) => row.name} empty="No leave usage matches this report." columns={[
    { key: 'name', label: 'Leave type', value: (row) => row.name, render: (row) => <span className="font-medium text-neutral-800">{row.name}</span> },
    { key: 'count', label: 'Requests', value: (row) => row.count, align: 'right' },
    { key: 'days', label: 'Working days', value: (row) => row.days, render: (row) => <span className="font-semibold">{row.days}</span>, align: 'right' },
  ]} /></ReportTable>;
}

function LeaveActivityTable({ rows }: { rows: Props['leave']['trend'] }) {
  return <ReportTable title="Leave activity report" description="Working leave days by reporting period and request status."><ReportDataTable rows={rows} rowKey={(row) => row.key} empty="No leave activity matches this report." columns={[
    { key: 'period', label: 'Period', value: (row) => row.key, render: (row) => <span className="font-medium text-neutral-800">{row.label}</span> },
    { key: 'approved', label: 'Approved', value: (row) => row.values.approved ?? 0, align: 'right' },
    { key: 'pending', label: 'Pending', value: (row) => row.values.pending ?? 0, align: 'right' },
    { key: 'rejected', label: 'Rejected', value: (row) => row.values.rejected ?? 0, align: 'right' },
  ]} /></ReportTable>;
}

function EmployeeLeaveTable({ rows, onFocus }: { rows: Props['leave']['rankings']; onFocus: (userId: number) => void }) {
  return <ReportTable title="Employee leave report" description="Approved leave totals by employee. Select a row to focus the report."><ReportDataTable rows={rows} rowKey={(row) => row.user_id} empty="No approved employee leave is recorded." onRowClick={(row) => onFocus(row.user_id)} columns={[
    { key: 'name', label: 'Employee', value: (row) => row.name, render: (row) => <span className="font-medium text-orange-700">{row.name}</span> },
    { key: 'department', label: 'Department', value: (row) => row.department },
    { key: 'requests', label: 'Requests', value: (row) => row.requests, align: 'right' },
    { key: 'days', label: 'Days', value: (row) => row.days, render: (row) => <span className="font-semibold">{row.days}</span>, align: 'right' },
  ]} /></ReportTable>;
}

function EmployeeBalanceTable({ rows, year }: { rows: Props['leave']['employee_balances']; year: number }) {
  return <ReportTable id="employee-balance-report" title="Employee balance report" description={`Used and available leave balance by employee for ${year}.`}><ReportDataTable rows={rows} rowKey={(row) => row.user_id} empty="No employee leave balances are available." columns={[
    { key: 'name', label: 'Employee', value: (row) => row.name, render: (row) => <span className="font-medium text-neutral-800">{row.name}</span> },
    { key: 'department', label: 'Department', value: (row) => row.department },
    { key: 'used', label: 'Used', value: (row) => row.used, align: 'right' },
    { key: 'available', label: 'Available', value: (row) => row.available, align: 'right' },
    { key: 'utilization', label: 'Utilization', value: (row) => row.utilization, render: (row) => <span className="font-semibold">{row.utilization}%</span>, align: 'right' },
  ]} /></ReportTable>;
}

function AbsenceConcurrencyTable({ rows }: { rows: Props['leave']['concurrency_distribution'] }) {
  return <ReportTable title="Concurrent absence report" description="Working days grouped by the number of employees simultaneously absent."><ReportDataTable rows={rows} rowKey={(row) => row.name} empty="No concurrent absence data is available." columns={[
    { key: 'name', label: 'Employees absent', value: (row) => row.name, render: (row) => <span className="font-medium text-neutral-800">{row.name}</span> },
    { key: 'days', label: 'Working days', value: (row) => row.days, render: (row) => <span className="font-semibold">{row.days}</span>, align: 'right' },
  ]} /></ReportTable>;
}

function AttendanceActivityTable({ rows }: { rows: Props['attendance']['trend'] }) {
  return <ReportTable id="attendance-activity-report" title="Attendance activity report" description="Finalized attendance outcomes and compliance by reporting period."><ReportDataTable rows={rows} rowKey={(row) => row.key} empty="No finalized attendance activity matches this report." columns={[
    { key: 'period', label: 'Period', value: (row) => row.key, render: (row) => <span className="font-medium text-neutral-800">{row.label}</span> },
    { key: 'complete', label: 'Complete', value: (row) => row.values.complete ?? 0, align: 'right' },
    { key: 'issues', label: 'Issues', value: (row) => row.values.issues ?? 0, align: 'right' },
    { key: 'compliance', label: 'Compliance', value: (row) => row.compliance ?? 0, render: (row) => <span className="font-semibold">{row.compliance ?? 0}%</span>, align: 'right' },
  ]} /></ReportTable>;
}

function AttendanceIssueSummaryTable({ rows }: { rows: Props['attendance']['issue_mix'] }) {
  return <ReportTable title="Attendance issue summary" description="Employee-days affected by each attendance issue type."><ReportDataTable rows={rows} rowKey={(row) => row.name} empty="No attendance issues match this report." columns={[
    { key: 'name', label: 'Issue type', value: (row) => row.name, render: (row) => <span className="font-medium text-neutral-800">{row.name}</span> },
    { key: 'value', label: 'Affected days', value: (row) => row.value, render: (row) => <span className="font-semibold">{row.value}</span>, align: 'right' },
  ]} /></ReportTable>;
}

function EmployeeAttendanceTable({ rows, onFocus }: { rows: Props['attendance']['employees']; onFocus: (userId: number) => void }) {
  return <ReportTable id="employee-attendance-report" title="Employee attendance report" description="Finalized attendance outcomes and issue totals by employee. Select a row to focus the report."><ReportDataTable rows={rows} rowKey={(row) => row.user_id} minWidth="760px" empty="No finalized employee attendance records match this report." onRowClick={(row) => onFocus(row.user_id)} columns={[
    { key: 'name', label: 'Employee', value: (row) => row.name, render: (row) => <span><span className="block font-medium text-orange-700">{row.name}</span><span className="text-xs text-neutral-400">{row.department}</span></span> },
    { key: 'complete', label: 'Complete', value: (row) => row.complete, align: 'right' },
    { key: 'issues', label: 'Issue days', value: (row) => row.issues, align: 'right' },
    { key: 'late', label: 'Late', value: (row) => row.late, align: 'right' },
    { key: 'early', label: 'Early', value: (row) => row.early, align: 'right' },
    { key: 'missing', label: 'Missing', value: (row) => row.missing, align: 'right' },
    { key: 'compliance', label: 'Compliance', value: (row) => row.compliance, render: (row) => <span className="font-semibold">{row.compliance}%</span>, align: 'right' },
  ]} /></ReportTable>;
}

function DepartmentAttendanceTable({ rows }: { rows: Props['attendance']['departments'] }) {
  return <ReportTable id="department-attendance-report" title="Department attendance report" description="Compliance and attendance issues by department."><ReportDataTable rows={rows} rowKey={(row) => row.name} empty="No department attendance records match this report." columns={[
    { key: 'name', label: 'Department', value: (row) => row.name, render: (row) => <span className="font-medium text-neutral-800">{row.name}</span> },
    { key: 'compliance', label: 'Compliance', value: (row) => row.compliance, render: (row) => <span className="font-semibold">{row.compliance}%</span>, align: 'right' },
    { key: 'late', label: 'Late', value: (row) => row.late, align: 'right' },
    { key: 'early', label: 'Early', value: (row) => row.early, align: 'right' },
    { key: 'missing', label: 'Missing', value: (row) => row.missing, align: 'right' },
  ]} /></ReportTable>;
}

function LeaveRequestTable({ filters, requests, onNavigate, onFocus }: {
  filters: Filters;
  requests: Paged<LeaveRequestRow>;
  onNavigate: (patch: Partial<Filters>) => void;
  onFocus: (userId: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [open, setOpen] = useState(true);
  const sort = (key: string) => onNavigate({
    leave_sort: key,
    leave_direction: filters.leave_sort !== key ? 'desc' : filters.leave_direction === 'asc' ? 'desc' : 'asc',
    page: 1,
  });

  return (
    <section id="leave-request-report" className="scroll-mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <RecordTableHeader title="Leave request details" description={`${requests.total} request${requests.total === 1 ? '' : 's'} in the selected scope`} filters={filters} onNavigate={onNavigate} open={open} onToggle={() => setOpen((value) => !value)} />
      {open && <><div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr><SortableHeader label="Employee" sortKey="name" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="Leave type" sortKey="leave_type" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="Period" sortKey="starts_at" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="In-range days" sortKey="days_in_period" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="Status" sortKey="status" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="Reason" sortKey="reason" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {requests.data.map((row) => (
              <Fragment key={row.id}>
                <tr className="align-top hover:bg-neutral-50/70">
                  <td className="px-4 py-3.5"><div className="font-semibold text-neutral-800">{row.name}</div><div className="mt-0.5 text-xs text-neutral-400">{row.employee_code ?? 'No code'} · {row.department}</div></td>
                  <td className="px-4 py-3.5 font-medium text-neutral-700">{row.leave_type}</td>
                  <td className="px-4 py-3.5"><div>{formatDate(row.starts_at)}</div><div className="mt-0.5 text-xs text-neutral-400">to {formatDate(row.ends_at)}</div></td>
                  <td className="px-4 py-3.5 font-semibold">{row.days_in_period}</td>
                  <td className="px-4 py-3.5"><StatusPill status={row.status} /></td>
                  <td className="max-w-xs px-4 py-3.5 text-neutral-600"><span className="line-clamp-2">{row.reason || 'No reason provided'}</span></td>
                  <td className="px-4 py-3.5 text-right"><button type="button" aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:border-orange-200 hover:text-orange-700">Details <ChevronDown size={13} className={expanded === row.id ? 'rotate-180' : ''} /></button></td>
                </tr>
                {expanded === row.id && (
                  <tr className="bg-orange-50/40"><td colSpan={7} className="px-5 py-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><DetailItem label="Submitted reason" value={row.reason || 'No reason provided'} /><DetailItem label="Manager comment" value={row.manager_comment || 'No comment'} /><DetailItem label="Approval" value={row.approver ? `${titleCase(row.status)} by ${row.approver}` : titleCase(row.status)} /><DetailItem label="Request accounting" value={`${row.requested_days} requested days · ${row.days_in_period} within this report`} /></div><button type="button" onClick={() => onFocus(row.user_id)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">Focus report on {row.name} <ArrowRight size={13} /></button></td></tr>
                )}
              </Fragment>
            ))}
            {!requests.data.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-400">No leave requests match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination rows={requests} onNavigate={onNavigate} /></>}
    </section>
  );
}

function AttendanceIssueTable({ filters, issueDays, onNavigate, onFocus }: {
  filters: Filters;
  issueDays: Paged<AttendanceIssueDay>;
  onNavigate: (patch: Partial<Filters>) => void;
  onFocus: (userId: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const showReview = issueDays.data.some((row) => row.flagged_events > 0);
  const sort = (key: string) => onNavigate({
    attendance_sort: key,
    attendance_direction: filters.attendance_sort !== key ? 'desc' : filters.attendance_direction === 'asc' ? 'desc' : 'asc',
    page: 1,
  });

  return (
    <section id="attendance-issue-report" className="scroll-mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <RecordTableHeader title="Attendance details" description={`${issueDays.total} finalized attendance record${issueDays.total === 1 ? '' : 's'} in the selected scope`} filters={filters} onNavigate={onNavigate} open={open} onToggle={() => setOpen((value) => !value)} />
      {open && <><div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-neutral-50/80 text-[11px] uppercase tracking-[0.08em] text-neutral-500"><tr><SortableHeader label="Employee" sortKey="name" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} /><SortableHeader label="Date" sortKey="date" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} /><th className="px-4 py-3 font-semibold">Morning In</th><th className="px-4 py-3 font-semibold">Lunch Out</th><th className="px-4 py-3 font-semibold">Lunch In</th><th className="px-4 py-3 font-semibold">Final Out</th>{showReview && <SortableHeader label="Review" sortKey="unresolved_flags" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} />}</tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {issueDays.data.map((row) => (
                <tr key={row.id} className="align-middle hover:bg-neutral-50/60">
                  <td className="px-4 py-3"><button type="button" onClick={() => onFocus(row.user_id)} className="text-left"><span className="block font-semibold text-neutral-800 hover:text-orange-700">{row.name}</span><span className="mt-0.5 block text-xs text-neutral-400">{row.department}</span></button></td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-700">{formatDate(row.date)}</td>
                  <PunchCell slot={row.slots.find((slot) => slot.type === 'morning_in')} />
                  <PunchCell slot={row.slots.find((slot) => slot.type === 'lunch_out')} />
                  <PunchCell slot={row.slots.find((slot) => slot.type === 'lunch_in')} />
                  <PunchCell slot={row.slots.find((slot) => slot.type === 'final_out')} />
                  {showReview && <td className="max-w-40 px-4 py-3 text-xs text-neutral-500">{row.unresolved_flags > 0 ? <span className="font-semibold text-red-600">{row.unresolved_flags} unresolved</span> : row.flagged_events > 0 ? <span className="text-emerald-700">Reviewed</span> : <span className="text-neutral-300">—</span>}</td>}
                </tr>
            ))}
            {!issueDays.data.length && <tr><td colSpan={showReview ? 7 : 6} className="px-4 py-12 text-center text-neutral-400">No finalized attendance records match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination rows={issueDays} onNavigate={onNavigate} /></>}
    </section>
  );
}

function PunchCell({ slot }: { slot?: AttendanceIssueDay['slots'][number] }) {
  const status = slot?.status ?? 'missing';
  const isIssue = status === 'late' || status === 'early' || status === 'missing';
  const tone = status === 'missing'
    ? 'text-red-600 before:bg-red-500'
    : 'text-orange-700 before:bg-orange-500';

  return (
    <td className="min-w-32 px-4 py-3">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="font-semibold text-neutral-800">{slot?.actual_at ? formatTime(slot.actual_at) : '—'}</span>
        {isIssue && <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide before:h-1.5 before:w-1.5 before:rounded-full ${tone}`}>{titleCase(status)}</span>}
      </div>
    </td>
  );
}

function SortableHeader({ label, sortKey, activeSort, direction, onSort, align = 'left' }: {
  label: string;
  sortKey: string;
  activeSort: string;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}) {
  const active = activeSort === sortKey;

  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className={`group inline-flex items-center gap-1.5 font-semibold transition hover:text-orange-700 ${align === 'right' ? 'justify-end' : ''} ${active ? 'text-orange-700' : ''}`}>
        {label}
        {active && <span aria-hidden="true" className="text-xs text-orange-600">{direction === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

function RecordTableHeader({ title, description, filters, onNavigate, open, onToggle }: { title: string; description: string; filters: Filters; onNavigate: (patch: Partial<Filters>) => void; open: boolean; onToggle: () => void }) {
  return <div className={`flex items-center justify-between gap-4 px-5 py-4 ${open ? 'border-b border-neutral-100' : ''}`}><button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"><span><span className="block font-semibold text-neutral-900">{title}</span><span className="mt-1 block text-xs text-neutral-500">{description}</span></span><ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <select aria-label="Rows per page" value={filters.per_page} onChange={(event) => onNavigate({ per_page: Number(event.target.value), page: 1 })} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs"><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option></select>}</div>;
}

function Pagination({ rows, onNavigate }: { rows: Pick<Paged<unknown>, 'page' | 'last_page'>; onNavigate: (patch: Partial<Filters>) => void }) {
  return <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4 text-xs text-neutral-500"><span>Page {rows.page} of {rows.last_page}</span><div className="flex gap-2"><button type="button" disabled={rows.page <= 1} onClick={() => onNavigate({ page: rows.page - 1 })} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={rows.page >= rows.last_page} onClick={() => onNavigate({ page: rows.page + 1 })} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold disabled:opacity-40">Next</button></div></div>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">{label}</div><div className="mt-1 text-sm leading-6 text-neutral-700">{value}</div></div>;
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = normalized.includes('approved') || normalized === 'on_time' || normalized === 'complete'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : normalized.includes('pending') ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : normalized.includes('late') || normalized.includes('early') ? 'bg-orange-50 text-orange-700 ring-orange-200'
        : normalized.includes('missing') || normalized.includes('rejected') || normalized.includes('flagged') ? 'bg-red-50 text-red-700 ring-red-200'
          : 'bg-neutral-100 text-neutral-600 ring-neutral-200';
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${tone}`}>{titleCase(status)}</span>;
}

function periodFor(preset: PeriodPreset) {
  const end = new Date();
  const start = new Date(end);
  if (preset === 'month') start.setDate(1);
  if (preset === '30') start.setDate(end.getDate() - 29);
  if (preset === 'quarter') {
    const quarterStartMonth = Math.floor(end.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    end.setMonth(quarterStartMonth + 3, 0);
  }
  if (preset === 'year') start.setMonth(0, 1);
  return { start_date: localDate(start), end_date: localDate(end) };
}

function periodMatches(filters: Pick<Filters, 'start_date' | 'end_date'>, preset: PeriodPreset) {
  const period = periodFor(preset);

  return filters.start_date === period.start_date && filters.end_date === period.end_date;
}

function matchingPeriodPreset(filters: Pick<Filters, 'start_date' | 'end_date'>): PeriodPreset | null {
  return PERIOD_PRESETS.find(([preset]) => periodMatches(filters, preset))?.[0] ?? null;
}

function localDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value?: string | null) {
  if (!value) return 'Missing';

  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function employeeSelectOption(employee: EmployeeOption): SelectOption {
  return { value: String(employee.id), label: `${employee.name}${employee.employee_code ? ` · ${employee.employee_code}` : ''}` };
}

function idSelectOption(option: IdOption): SelectOption {
  return { value: String(option.id), label: option.name };
}

function queryPayload(filters: Filters) {
  return {
    ...filters,
    department_ids: filters.department_ids,
    manager_ids: filters.manager_ids,
    role_slugs: filters.role_slugs,
    employee_ids: filters.employee_ids,
    leave_type_ids: filters.leave_type_ids,
    leave_statuses: filters.leave_statuses,
    attendance_statuses: filters.attendance_statuses,
    attendance_statuses_explicit: 1,
    attendance_issues: filters.attendance_issues,
  };
}

function queryString(filters: Filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => params.append(`${key}[]`, String(item)));
    else params.set(key, String(value));
  });
  params.set('attendance_statuses_explicit', '1');
  return params.toString();
}

function sectionButton(active: boolean) {
  return `inline-flex min-w-32 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${active ? 'bg-orange-50 text-orange-800' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`;
}

function periodButton(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-orange-300 bg-orange-50 text-orange-800 shadow-sm' : 'border-neutral-200 text-neutral-600 hover:border-orange-200 hover:text-orange-700'}`;
}

const inputClass = 'h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5';
const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: 42,
    borderColor: state.isFocused ? '#f97316' : '#e5e5e5',
    boxShadow: state.isFocused ? '0 0 0 4px rgba(249,115,22,.05)' : 'none',
    fontSize: 13,
    '&:hover': { borderColor: '#fed7aa' },
  }),
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 50 }),
};
