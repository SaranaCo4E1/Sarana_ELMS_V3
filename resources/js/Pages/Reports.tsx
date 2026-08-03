import { router, usePage } from '@inertiajs/react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Filter,
  Lightbulb,
  MapPin,
  RefreshCw,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import AppLayout from '../Layouts/AppLayout';
import type { PageProps } from '../types';

const ReportChart = lazy(() => import('../Components/ReportChart'));

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
  site: string;
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
  site_ids: number[];
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
    sites: IdOption[];
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
const CHART_COLORS = ['#ea580c', '#f59e0b', '#0f766e', '#2563eb', '#7c3aed', '#dc2626'];
const PERIOD_PRESETS: [PeriodPreset, string][] = [
  ['month', 'This month'],
  ['30', 'Last 30 days'],
  ['quarter', 'This quarter'],
  ['year', 'This year'],
];

export default function Reports(props: Props) {
  const { capabilities, filterOptions, filters, summary, leave, attendance } = props;
  const { auth } = usePage<PageProps>().props;
  const canSeeAttendanceCalendar = capabilities.team || capabilities.organization;
  const [draft, setDraft] = useState<Filters>(filters);
  const [selectedPeriodPreset, setSelectedPeriodPreset] = useState<PeriodPreset | null>(
    () => matchingPeriodPreset(filters),
  );
  const [loading, setLoading] = useState(false);
  const [leaveTrendMode, setLeaveTrendMode] = useState<'line' | 'bar'>('line');
  const [compositionMode, setCompositionMode] = useState<'donut' | 'treemap'>('donut');
  const [attendanceMode, setAttendanceMode] = useState<'line' | 'bar'>('line');
  const [issueMode, setIssueMode] = useState<'donut' | 'bar'>('donut');

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

  const availableEmployees = useMemo(
    () => filterOptions.employees.filter((employee) => (
      draft.view === 'individual' || capabilities.organization || employee.id !== auth.user.id
    )),
    [auth.user.id, capabilities.organization, draft.view, filterOptions.employees],
  );

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

  const periodFilename = `${filters.start_date}-to-${filters.end_date}`;
  const leaveTrendOption = useMemo(() => trendOption(
    leave.trend,
    ['approved', 'pending', 'rejected'],
    leaveTrendMode,
    'Working days',
  ), [leave.trend, leaveTrendMode]);
  const attendanceTrendOption = useMemo(() => attendanceTrend(
    attendance.trend,
    attendanceMode,
  ), [attendance.trend, attendanceMode]);
  const leaveCompositionOption = useMemo(
    () => compositionOption(leave.types.map((row) => ({ name: row.name, value: row.days })), compositionMode),
    [compositionMode, leave.types],
  );
  const issueOption = useMemo(
    () => compositionOption(attendance.issue_mix, issueMode),
    [attendance.issue_mix, issueMode],
  );
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

  const selectView = (view: Filters['view']) => {
    if (view === draft.view) return;

    const next = { ...draft, view, employee_ids: [], page: 1 };
    setDraft(next);
    router.get('/reports', queryPayload(next), {
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
      attendance_statuses: [],
      site_ids: [],
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
      ? { attendance_statuses: [], site_ids: [] }
      : section === 'attendance'
        ? { leave_type_ids: [], leave_statuses: [] }
        : { leave_type_ids: [], leave_statuses: [], attendance_statuses: [], site_ids: [] };
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

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
              <BarChart3 size={15} />
              {props.scope === 'organization' ? 'Organization analytics' : props.scope === 'team' ? 'Direct-report analytics' : 'Personal analytics'}
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

        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {capabilities.can_select_individual && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <div className="flex rounded-lg bg-neutral-100 p-1">
                <button
                  type="button"
                  onClick={() => selectView('individual')}
                  className={viewButton(draft.view === 'individual')}
                >
                  <UserRound size={14} /> Individual
                </button>
                <button
                  type="button"
                  onClick={() => selectView('multi')}
                  className={viewButton(draft.view === 'multi')}
                >
                  <Users size={14} /> Group Report
                </button>
              </div>
              <span className="text-xs font-medium text-neutral-400">
                {loading ? 'Updating report…' : `${summary.employees} employee${summary.employees === 1 ? '' : 's'} in scope`}
              </span>
            </div>
          )}

          <div className="space-y-5 p-5">
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

              {draft.view === 'individual' && capabilities.can_select_individual ? (
                <FilterField label="Employee" icon={<UserRound size={14} />}>
                  <Select<SelectOption, false>
                    options={availableEmployees.map(employeeSelectOption)}
                    value={availableEmployees.filter((employee) => draft.employee_ids[0] === employee.id).map(employeeSelectOption)[0] ?? null}
                    onChange={(option) => updateDraft({ employee_ids: option ? [Number(option.value)] : [] })}
                    isClearable
                    placeholder="Me"
                    styles={selectStyles}
                  />
                </FilterField>
              ) : null}

              {draft.view === 'multi' && (
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
                  <FilterField label="Branches" icon={<Building2 size={14} />}>
                    <MultiSelect options={filterOptions.sites.map(idSelectOption)} values={draft.site_ids.map(String)} onChange={(values) => updateDraft({ site_ids: values.map(Number) })} placeholder="All branches" />
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
          </div>
        </section>

        <KpiGrid summary={summary} section={filters.section} />

        <Findings
          section={filters.section}
          leave={leave}
          attendance={attendance}
          onFocus={focusEmployee}
        />

        <Suspense fallback={<ChartSkeleton />}>
          {filters.section === 'overview' && (
            <div className="grid gap-5 xl:grid-cols-2">
              <ChartWithToggle
                modes={['line', 'bar']}
                value={leaveTrendMode}
                onChange={(value) => setLeaveTrendMode(value as 'line' | 'bar')}
              >
                <ReportChart
                  title="Leave activity"
                  description="Working leave days in the selected period, grouped by current request status."
                  filename={`leave-activity-${periodFilename}`}
                  option={leaveTrendOption}
                />
              </ChartWithToggle>
              <ChartWithToggle modes={['line', 'bar']} value={attendanceMode} onChange={(value) => setAttendanceMode(value as 'line' | 'bar')}>
                <ReportChart
                  title="Attendance compliance"
                  description="Complete versus issue attendance days and the resulting compliance percentage."
                  filename={`attendance-compliance-${periodFilename}`}
                  option={attendanceTrendOption}
                />
              </ChartWithToggle>
              {canSeeAttendanceCalendar && (
                <ReportChart
                  title="Attendance calendar"
                  description="Issue-day intensity across the selected calendar period."
                  filename={`attendance-calendar-${periodFilename}`}
                  option={heatmapOption(attendance.heatmap, filters.start_date, filters.end_date)}
                />
              )}
              <ReportChart
                title="Leave balance utilization"
                description={`Used, pending, and available leave balances for ${leave.balance_year}.`}
                filename={`leave-balances-${leave.balance_year}`}
                option={balanceOption(leave.balances)}
              />
            </div>
          )}

          {filters.section === 'leave' && (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <ReportChart
                  title="Leave balance utilization"
                  description={`Used, pending, and available leave balances for ${leave.balance_year}.`}
                  filename={`leave-balances-${leave.balance_year}`}
                  option={balanceOption(leave.balances)}
                />
                <ChartWithToggle modes={['donut', 'treemap']} value={compositionMode} onChange={(value) => setCompositionMode(value as 'donut' | 'treemap')}>
                  <ReportChart
                    title="Leave by type"
                    description="Working leave days split by leave type."
                    filename={`leave-types-${periodFilename}`}
                    option={leaveCompositionOption}
                  />
                </ChartWithToggle>
                <ChartWithToggle modes={['line', 'bar']} value={leaveTrendMode} onChange={(value) => setLeaveTrendMode(value as 'line' | 'bar')}>
                  <ReportChart
                    title="Leave activity trend"
                    description="Approved, pending, and rejected working days over time."
                    filename={`leave-trend-${periodFilename}`}
                    option={leaveTrendOption}
                  />
                </ChartWithToggle>
                {filters.view === 'multi' && (
                  <ReportChart
                    title="Absence concurrency distribution"
                    description="Working days grouped by how many employees were simultaneously on approved leave."
                    filename={`absence-concurrency-distribution-${periodFilename}`}
                    option={concurrencyDistributionOption(leave.concurrency_distribution)}
                  />
                )}
                {filters.view === 'multi' && (
                  <ReportChart
                    title="Approved leave ranking"
                    description="Named employee comparison, limited to the current authorized scope. Select a bar to focus the report on that employee."
                    filename={`leave-ranking-${periodFilename}`}
                    option={rankingOption(leave.rankings.slice(0, 15).map((row) => ({ name: row.name, value: row.days, user_id: row.user_id })), 'Working days')}
                    onDataClick={(data) => data.user_id && focusEmployee(data.user_id)}
                  />
                )}
                {filters.view === 'multi' && (
                  <ReportChart
                    title="Balance utilization by employee"
                    description={`Employee balance utilization for ${leave.balance_year}.`}
                    filename={`employee-balance-utilization-${leave.balance_year}`}
                    option={rankingOption(leave.employee_balances.slice(0, 15).map((row) => ({ name: row.name, value: row.utilization })), 'Utilization %')}
                  />
                )}
              </div>
              <LeaveRequestTable filters={filters} requests={leave.requests} onNavigate={apply} onFocus={focusEmployee} />
            </div>
          )}

          {filters.section === 'attendance' && (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <ChartWithToggle modes={['line', 'bar']} value={attendanceMode} onChange={(value) => setAttendanceMode(value as 'line' | 'bar')}>
                  <ReportChart
                    title="Attendance compliance trend"
                    description="Finalized complete and issue attendance records over time. In-progress and non-working days are excluded."
                    filename={`attendance-trend-${periodFilename}`}
                    option={attendanceTrendOption}
                  />
                </ChartWithToggle>
                {canSeeAttendanceCalendar && (
                  <ReportChart
                    title="Attendance calendar"
                    description="Issue-day intensity across the selected calendar period."
                    filename={`attendance-calendar-${periodFilename}`}
                    option={heatmapOption(attendance.heatmap, filters.start_date, filters.end_date)}
                  />
                )}
                <ChartWithToggle modes={['donut', 'bar']} value={issueMode} onChange={(value) => setIssueMode(value as 'donut' | 'bar')}>
                  <ReportChart
                    title="Attendance issue mix"
                    description="Employee-days affected by late in, early out, or a missing punch, plus flagged events."
                    filename={`attendance-issues-${periodFilename}`}
                    option={issueOption}
                  />
                </ChartWithToggle>
                <ReportChart
                  title="Complete vs issue days"
                  description="A simple count of finalized attendance days for each employee."
                  filename={`attendance-outcomes-${periodFilename}`}
                  option={attendanceOutcomeOption(attendance.employees.slice(0, 15))}
                />
                {filters.view === 'multi' && (
                  <ReportChart
                    title="Employee attendance compliance"
                    description="Named compliance comparison, limited to the current authorized scope. Select a bar to focus the report on that employee."
                    filename={`employee-attendance-${periodFilename}`}
                    option={rankingOption(attendance.employees.slice(0, 15).map((row) => ({ name: row.name, value: row.compliance, user_id: row.user_id })), 'Compliance %')}
                    onDataClick={(data) => data.user_id && focusEmployee(data.user_id)}
                  />
                )}
                {filters.view === 'multi' && attendance.departments.length > 1 && (
                  <ReportChart
                    title="Department attendance comparison"
                    description="Compliance and attendance issues across departments in scope."
                    filename={`department-attendance-${periodFilename}`}
                    option={departmentOption(attendance.departments, capabilities.organization && attendance.departments.length <= 8)}
                  />
                )}
              </div>
              <AttendanceIssueTable filters={filters} issueDays={attendance.issue_days} onNavigate={apply} onFocus={focusEmployee} />
            </div>
          )}
        </Suspense>
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

function KpiGrid({ summary, section }: { summary: Props['summary']; section: Filters['section'] }) {
  const cards = [
    ['Employees', summary.employees, <Users size={17} />, 'neutral'],
    ['Approved leave', `${summary.approved_leave_days} days`, <CalendarRange size={17} />, 'orange'],
    ['Pending leave', `${summary.pending_leave_days} days`, <Clock3 size={17} />, 'amber'],
    ['Available balance', `${summary.available_balance} days`, <CheckCircle2 size={17} />, 'teal'],
    ['Compliance', `${summary.attendance_compliance}%`, <Activity size={17} />, 'blue'],
    ['Late-in days / early-out days', `${summary.late} / ${summary.early}`, <Clock3 size={17} />, 'purple'],
    ['Missing-punch days', summary.missing, <TriangleAlert size={17} />, 'red'],
    // ['Unresolved flags', summary.unresolved_flags, <TriangleAlert size={17} />, 'red'],
  ];
  const visibleLabels = section === 'leave'
    ? ['Employees', 'Approved leave', 'Pending leave', 'Available balance']
    : section === 'attendance'
      ? ['Employees', 'Compliance', 'Late-in days / early-out days', 'Missing-punch days', 'Unresolved flags']
      : cards.map(([label]) => String(label));
  const visibleCards = cards.filter(([label]) => visibleLabels.includes(String(label)));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visibleCards.map(([label, value, icon, tone]) => (
        <div key={String(label)} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass(String(tone))}`}>{icon}</div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">{value}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</div>
        </div>
      ))}
    </div>
  );
}

function Findings({ section, leave, attendance, onFocus }: {
  section: Filters['section'];
  leave: Props['leave'];
  attendance: Props['attendance'];
  onFocus: (userId: number) => void;
}) {
  const findings: { key: string; label: string; value: string; detail: string; userId?: number }[] = [];
  const topEmployee = leave.insights.top_employee;
  const topType = leave.insights.top_type;
  const peakAbsence = leave.insights.peak_absence;
  const topIssueEmployee = attendance.insights.top_issue_employee;
  const peakIssueDate = attendance.insights.peak_issue_date;
  const lowestDepartment = attendance.insights.lowest_department;

  if (section !== 'attendance' && topEmployee) {
    findings.push({
      key: 'top-leave',
      label: 'Most approved leave',
      value: `${topEmployee.name} · ${topEmployee.days} working days`,
      detail: `${topEmployee.requests} request${topEmployee.requests === 1 ? '' : 's'}${topEmployee.primary_type ? `, mainly ${topEmployee.primary_type}` : ''}.`,
      userId: topEmployee.user_id,
    });
  }
  if (section === 'leave' && topType) {
    findings.push({ key: 'top-type', label: 'Most-used leave type', value: topType.name, detail: `${topType.days} approved working days in the selected period.` });
  }
  if (section !== 'attendance' && peakAbsence) {
    findings.push({ key: 'peak-absence', label: 'Highest simultaneous absence', value: `${peakAbsence.employees} employees`, detail: `Peak approved absence occurred on ${formatDate(peakAbsence.date)}.` });
  }
  if (section !== 'leave' && topIssueEmployee && topIssueEmployee.issues > 0) {
    findings.push({
      key: 'top-issues',
      label: 'Most attendance issue-days',
      value: `${topIssueEmployee.name} · ${topIssueEmployee.issues} days`,
      detail: `${topIssueEmployee.late} late, ${topIssueEmployee.early} early, and ${topIssueEmployee.missing} missing-punch day(s).`,
      userId: topIssueEmployee.user_id,
    });
  }
  if (section === 'attendance' && peakIssueDate) {
    findings.push({ key: 'peak-issues', label: 'Highest issue date', value: `${formatDate(peakIssueDate.date)} · ${peakIssueDate.issues} records`, detail: `${peakIssueDate.issues} of ${peakIssueDate.records} finalized attendance record(s) had issues.` });
  }
  if (section !== 'leave' && lowestDepartment) {
    findings.push({ key: 'lowest-department', label: 'Lowest department compliance', value: `${lowestDepartment.name} · ${lowestDepartment.compliance}%`, detail: `${lowestDepartment.late} late, ${lowestDepartment.early} early, and ${lowestDepartment.missing} missing-punch day(s).` });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-amber-100 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Lightbulb size={18} /></div>
        <div>
          <h2 className="font-semibold text-neutral-900">Important findings</h2>
          <p className="mt-0.5 text-xs leading-5 text-neutral-500">Direct answers from the selected period and employee scope.</p>
        </div>
      </div>
      {findings.length ? (
        <div className="grid gap-px bg-amber-100 md:grid-cols-2 xl:grid-cols-3">
          {findings.map((finding) => (
            <article key={finding.key} className="flex min-h-36 flex-col bg-white p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">{finding.label}</div>
              <div className="mt-2 text-lg font-semibold text-neutral-900">{finding.value}</div>
              <p className="mt-1 text-sm leading-6 text-neutral-500">{finding.detail}</p>
              {finding.userId && (
                <button type="button" onClick={() => onFocus(finding.userId!)} className="mt-auto inline-flex items-center gap-1.5 pt-3 text-xs font-semibold text-orange-700 hover:text-orange-800">
                  Focus on employee <ArrowRight size={13} />
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="px-5 py-7 text-sm text-neutral-500">There is not enough activity in this selection to identify a notable finding.</p>
      )}
    </section>
  );
}

function ChartWithToggle({ modes, value, onChange, children }: { modes: string[]; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative min-w-0">
      <div className="absolute right-24 top-3.5 z-10 flex rounded-md bg-neutral-100 p-0.5">
        {modes.map((mode) => (
          <button key={mode} type="button" onClick={() => onChange(mode)} className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${value === mode ? 'bg-white text-orange-700 shadow-sm' : 'text-neutral-400'}`}>
            {mode}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

function LeaveRequestTable({ filters, requests, onNavigate, onFocus }: {
  filters: Filters;
  requests: Paged<LeaveRequestRow>;
  onNavigate: (patch: Partial<Filters>) => void;
  onFocus: (userId: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const sort = (key: string) => onNavigate({
    leave_sort: key,
    leave_direction: filters.leave_sort === key && filters.leave_direction === 'asc' ? 'desc' : 'asc',
    page: 1,
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <RecordTableHeader title="Leave request details" description={`${requests.total} request${requests.total === 1 ? '' : 's'} in the selected scope`} filters={filters} onNavigate={onNavigate} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr><SortableHeader label="Employee" sortKey="name" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="Leave type" sortKey="leave_type" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="Period" sortKey="starts_at" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="In-range days" sortKey="days_in_period" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><SortableHeader label="Status" sortKey="status" activeSort={filters.leave_sort} direction={filters.leave_direction} onSort={sort} /><th className="px-4 py-3">Reason</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
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
      <Pagination rows={requests} onNavigate={onNavigate} />
    </section>
  );
}

function AttendanceIssueTable({ filters, issueDays, onNavigate, onFocus }: {
  filters: Filters;
  issueDays: Paged<AttendanceIssueDay>;
  onNavigate: (patch: Partial<Filters>) => void;
  onFocus: (userId: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const sort = (key: string) => onNavigate({
    attendance_sort: key,
    attendance_direction: filters.attendance_sort === key && filters.attendance_direction === 'asc' ? 'desc' : 'asc',
    page: 1,
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <RecordTableHeader title="Attendance issue details" description={`${issueDays.total} finalized issue or flagged day${issueDays.total === 1 ? '' : 's'} in the selected scope`} filters={filters} onNavigate={onNavigate} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><SortableHeader label="Employee" sortKey="name" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} /><SortableHeader label="Date" sortKey="date" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} /><SortableHeader label="Branch" sortKey="site" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} /><SortableHeader label="Issues" sortKey="issue_count" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} /><SortableHeader label="Review" sortKey="unresolved_flags" activeSort={filters.attendance_sort} direction={filters.attendance_direction} onSort={sort} /><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {issueDays.data.map((row) => (
              <Fragment key={row.id}>
                <tr className="hover:bg-neutral-50/70">
                  <td className="px-4 py-3.5"><div className="font-semibold text-neutral-800">{row.name}</div><div className="mt-0.5 text-xs text-neutral-400">{row.department}</div></td>
                  <td className="px-4 py-3.5 font-medium">{formatDate(row.date)}</td>
                  <td className="px-4 py-3.5"><span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-neutral-400" />{row.site}</span></td>
                  <td className="px-4 py-3.5"><div className="flex flex-wrap gap-1.5">{row.issues.map((issue) => <StatusPill key={issue} status={issue} />)}{row.flagged_events > 0 && <StatusPill status={`${row.flagged_events} flagged`} />}</div></td>
                  <td className="px-4 py-3.5 text-neutral-600">{row.unresolved_flags > 0 ? `${row.unresolved_flags} unresolved flag(s)` : row.flagged_events > 0 ? 'Reviewed' : 'No verification flags'}</td>
                  <td className="px-4 py-3.5 text-right"><button type="button" aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:border-orange-200 hover:text-orange-700">Punches <ChevronDown size={13} className={expanded === row.id ? 'rotate-180' : ''} /></button></td>
                </tr>
                {expanded === row.id && (
                  <tr className="bg-orange-50/40"><td colSpan={6} className="px-5 py-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{row.slots.map((slot) => <div key={slot.type} className="rounded-xl border border-neutral-200 bg-white p-3"><div className="text-xs font-bold uppercase tracking-wide text-neutral-500">{titleCase(slot.type)}</div><div className="mt-2 flex items-center justify-between gap-2"><div><div className="text-[10px] uppercase text-neutral-400">Expected</div><div className="font-semibold text-neutral-700">{formatTime(slot.expected_at)}</div></div><ArrowRight size={14} className="text-neutral-300" /><div className="text-right"><div className="text-[10px] uppercase text-neutral-400">Actual</div><div className="font-semibold text-neutral-700">{formatTime(slot.actual_at)}</div></div></div><div className="mt-2"><StatusPill status={slot.status} /></div></div>)}</div><button type="button" onClick={() => onFocus(row.user_id)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">Focus report on {row.name} <ArrowRight size={13} /></button></td></tr>
                )}
              </Fragment>
            ))}
            {!issueDays.data.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-neutral-400">No finalized attendance issue or flagged days match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination rows={issueDays} onNavigate={onNavigate} />
    </section>
  );
}

function SortableHeader({ label, sortKey, activeSort, direction, onSort }: {
  label: string;
  sortKey: string;
  activeSort: string;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const active = activeSort === sortKey;

  return (
    <th className="px-4 py-3" aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className={`group inline-flex items-center gap-1.5 font-semibold transition hover:text-orange-700 ${active ? 'text-orange-700' : ''}`}>
        {label}
        <span aria-hidden="true" className={`text-xs ${active ? 'text-orange-600' : 'text-neutral-300 group-hover:text-orange-400'}`}>{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}

function RecordTableHeader({ title, description, filters, onNavigate }: { title: string; description: string; filters: Filters; onNavigate: (patch: Partial<Filters>) => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4"><div><h3 className="font-semibold text-neutral-900">{title}</h3><p className="mt-1 text-xs text-neutral-500">{description}</p></div><select aria-label="Rows per page" value={filters.per_page} onChange={(event) => onNavigate({ per_page: Number(event.target.value), page: 1 })} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs"><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option></select></div>;
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

function ChartSkeleton() {
  return <div className="grid gap-5 xl:grid-cols-2"><div className="h-96 animate-pulse rounded-2xl bg-neutral-100" /><div className="h-96 animate-pulse rounded-2xl bg-neutral-100" /></div>;
}

function trendOption(rows: TrendRow[], keys: string[], mode: 'line' | 'bar', yName: string) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 8 },
    grid: { left: 55, right: 25, top: 55, bottom: 50 },
    xAxis: { type: 'category', data: rows.map((row) => row.label), axisLabel: { rotate: rows.length > 12 ? 35 : 0 } },
    yAxis: { type: 'value', name: yName, minInterval: 1 },
    dataZoom: rows.length > 18 ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 6 }] : [],
    series: keys.map((key, index) => ({
      name: titleCase(key),
      type: mode,
      smooth: mode === 'line',
      stack: mode === 'bar' ? 'total' : undefined,
      areaStyle: mode === 'line' ? { opacity: 0.08 } : undefined,
      itemStyle: { color: CHART_COLORS[index] },
      data: rows.map((row) => row.values[key] ?? 0),
    })),
  };
}

function attendanceTrend(rows: TrendRow[], mode: 'line' | 'bar') {
  const option = trendOption(rows, ['complete', 'issues'], mode, 'Records');

  return {
    ...option,
    yAxis: [{ type: 'value', name: 'Records', minInterval: 1 }, { type: 'value', name: '%', min: 0, max: 100 }],
    series: [
      ...option.series,
      {
        name: 'Compliance %',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        itemStyle: { color: '#111827' },
        data: rows.map((row) => row.compliance ?? 0),
      },
    ],
  };
}

function compositionOption(data: { name: string; value: number }[], mode: 'donut' | 'treemap' | 'bar') {
  if (mode === 'treemap') {
    return { tooltip: { trigger: 'item' }, series: [{ type: 'treemap', roam: false, breadcrumb: { show: false }, label: { show: true, formatter: '{b}\n{c}' }, data }] };
  }
  if (mode === 'bar') {
    return rankingOption(data, 'Occurrences');
  }
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 8 },
    series: [{ type: 'pie', radius: ['46%', '72%'], center: ['50%', '45%'], label: { formatter: '{b}\n{c}' }, data }],
  };
}

function balanceOption(rows: Props['leave']['balances']) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 8 },
    grid: { left: 110, right: 25, top: 55, bottom: 35 },
    xAxis: { type: 'value', name: 'Days' },
    yAxis: { type: 'category', data: rows.map((row) => row.name) },
    series: [
      { name: 'Used', type: 'bar', stack: 'balance', data: rows.map((row) => row.used) },
      { name: 'Pending', type: 'bar', stack: 'balance', data: rows.map((row) => row.pending) },
      { name: 'Available', type: 'bar', stack: 'balance', data: rows.map((row) => row.available) },
    ],
  };
}

function concurrencyDistributionOption(rows: Props['leave']['concurrency_distribution']) {
  const colors = ['#0f766e', '#2563eb', '#f59e0b', '#dc2626'];

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 65, right: 25, top: 30, bottom: 45 },
    xAxis: { type: 'category', data: rows.map((row) => row.name) },
    yAxis: { type: 'value', name: 'Working days', minInterval: 1 },
    series: [{
      name: 'Working days',
      type: 'bar',
      barMaxWidth: 64,
      label: { show: true, position: 'top' },
      data: rows.map((row, index) => ({
        value: row.days,
        itemStyle: { color: colors[index] },
      })),
    }],
  };
}

function rankingOption(rows: { name: string; value: number; user_id?: number }[], valueName: string) {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 35, top: 25, bottom: 35 },
    xAxis: { type: 'value', name: valueName },
    yAxis: { type: 'category', data: sorted.map((row) => row.name), axisLabel: { width: 105, overflow: 'truncate' } },
    series: [{ type: 'bar', data: sorted.map((row) => ({ value: row.value, user_id: row.user_id })), label: { show: true, position: 'right' } }],
  };
}

function heatmapOption(rows: Props['attendance']['heatmap'], start: string, end: string) {
  const max = Math.max(1, ...rows.map((row) => row.issues));
  return {
    tooltip: { formatter: (params: { data: [string, number] }) => `${formatDate(params.data[0])}: ${params.data[1]} issue record(s)` },
    visualMap: { min: 0, max, orient: 'horizontal', left: 'center', bottom: 8, inRange: { color: ['#fff7ed', '#fdba74', '#c2410c'] } },
    calendar: { top: 35, left: 35, right: 20, cellSize: ['auto', 18], range: [start, end], itemStyle: { borderWidth: 2, borderColor: '#fff' }, yearLabel: { show: true } },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: rows.map((row) => [row.date, row.issues]) }],
  };
}

function attendanceOutcomeOption(rows: Props['attendance']['employees']) {
  const sorted = [...rows].sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 8 },
    grid: { left: 120, right: 30, top: 55, bottom: 35 },
    xAxis: { type: 'value', name: 'Finalized days', minInterval: 1 },
    yAxis: { type: 'category', data: sorted.map((row) => row.name), axisLabel: { width: 105, overflow: 'truncate' } },
    series: [
      { name: 'Complete', type: 'bar', stack: 'days', color: '#0f766e', data: sorted.map((row) => row.complete) },
      { name: 'Issues', type: 'bar', stack: 'days', color: '#f97316', data: sorted.map((row) => row.issues) },
    ],
  };
}

function departmentOption(rows: Props['attendance']['departments'], radar: boolean) {
  if (radar) {
    const issueMax = Math.max(1, ...rows.flatMap((row) => [row.late, row.early, row.missing]));
    return {
      tooltip: {},
      legend: { bottom: 6 },
      radar: { indicator: [{ name: 'Compliance', max: 100 }, { name: 'Late-in days', max: issueMax }, { name: 'Early-out days', max: issueMax }, { name: 'Missing-punch days', max: issueMax }] },
      series: [{ type: 'radar', data: rows.map((row) => ({ name: row.name, value: [row.compliance, row.late, row.early, row.missing] })) }],
    };
  }
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 8 },
    grid: { left: 55, right: 25, top: 55, bottom: 55 },
    xAxis: { type: 'category', data: rows.map((row) => row.name) },
    yAxis: { type: 'value' },
    series: [
      { name: 'Compliance %', type: 'bar', data: rows.map((row) => row.compliance) },
      { name: 'Late-in days', type: 'bar', data: rows.map((row) => row.late) },
      { name: 'Missing-punch days', type: 'bar', data: rows.map((row) => row.missing) },
    ],
  };
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
    site_ids: filters.site_ids,
  };
}

function queryString(filters: Filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => params.append(`${key}[]`, String(item)));
    else params.set(key, String(value));
  });
  return params.toString();
}

function toneClass(tone: string) {
  return {
    neutral: 'bg-neutral-100 text-neutral-600',
    orange: 'bg-orange-50 text-orange-700',
    amber: 'bg-amber-50 text-amber-700',
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
  }[tone] ?? 'bg-neutral-100 text-neutral-600';
}

function viewButton(active: boolean) {
  return `inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${active ? 'bg-white text-orange-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`;
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
