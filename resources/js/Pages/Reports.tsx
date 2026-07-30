import { router, usePage } from '@inertiajs/react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  RefreshCw,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
type TrendRow = {
  key: string;
  label: string;
  values: Record<string, number>;
  compliance?: number;
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
    rankings: { user_id: number; name: string; department: string; days: number }[];
    concurrent: { date: string; employees: number }[];
  };
  attendance: {
    trend: TrendRow[];
    heatmap: { date: string; records: number; issues: number }[];
    issue_mix: { name: string; value: number }[];
    variance: { date: string; type: string; minutes: number; employee?: string | null }[];
    employees: { user_id: number; name: string; department: string; compliance: number; late: number; early: number; missing: number; records: number }[];
    departments: { name: string; compliance: number; late: number; early: number; missing: number }[];
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

export default function Reports(props: Props) {
  const { capabilities, filterOptions, filters, summary, leave, attendance, details } = props;
  const { auth } = usePage<PageProps>().props;
  const [draft, setDraft] = useState<Filters>(filters);
  const [loading, setLoading] = useState(false);
  const [leaveTrendMode, setLeaveTrendMode] = useState<'line' | 'bar'>('line');
  const [compositionMode, setCompositionMode] = useState<'donut' | 'treemap'>('donut');
  const [attendanceMode, setAttendanceMode] = useState<'line' | 'bar'>('line');
  const [issueMode, setIssueMode] = useState<'donut' | 'bar'>('donut');
  const [varianceMode, setVarianceMode] = useState<'scatter' | 'boxplot'>('scatter');

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
  };

  const apply = (overrides: Partial<Filters> = {}) => {
    router.get('/reports', queryPayload({ ...draft, ...overrides }), {
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };

  const applyPeriod = (preset: string) => {
    const next = { ...draft, ...periodFor(preset), page: 1 };
    setDraft(next);
    router.get('/reports', queryPayload(next), {
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };

  const reset = () => {
    const now = new Date();
    const clean: Filters = {
      ...filters,
      view: capabilities.team || capabilities.organization ? 'multi' : 'individual',
      section: filters.section,
      start_date: `${now.getFullYear()}-01-01`,
      end_date: localDate(now),
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
    };
    setDraft(clean);
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
                  onClick={() => updateDraft({ view: 'individual', employee_ids: [] })}
                  className={viewButton(draft.view === 'individual')}
                >
                  <UserRound size={14} /> Individual
                </button>
                <button
                  type="button"
                  onClick={() => updateDraft({ view: 'multi', employee_ids: [] })}
                  className={viewButton(draft.view === 'multi')}
                >
                  <Users size={14} /> Multi-person
                </button>
              </div>
              <span className="text-xs font-medium text-neutral-400">
                {loading ? 'Updating report…' : `${summary.employees} employee${summary.employees === 1 ? '' : 's'} in scope`}
              </span>
            </div>
          )}

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              {[
                ['month', 'This month'],
                ['30', 'Last 30 days'],
                ['quarter', 'This quarter'],
                ['year', 'This year'],
              ].map(([preset, label]) => (
                <button key={preset} type="button" onClick={() => applyPeriod(preset)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-orange-200 hover:text-orange-700">
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Start date" icon={<CalendarRange size={14} />}>
                <input type="date" value={draft.start_date} onChange={(event) => updateDraft({ start_date: event.target.value })} className={inputClass} />
              </FilterField>
              <FilterField label="End date" icon={<CalendarRange size={14} />}>
                <input type="date" min={draft.start_date} value={draft.end_date} onChange={(event) => updateDraft({ end_date: event.target.value })} className={inputClass} />
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
              <ReportChart
                title="Attendance calendar"
                description="Issue-day intensity across the selected calendar period."
                filename={`attendance-calendar-${periodFilename}`}
                option={heatmapOption(attendance.heatmap, filters.start_date, filters.end_date)}
              />
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
                    title="Concurrent approved absence"
                    description="Number of employees simultaneously on approved leave on each working day."
                    filename={`concurrent-absence-${periodFilename}`}
                    option={simpleLineOption(leave.concurrent.map((row) => row.date), leave.concurrent.map((row) => row.employees), 'Employees')}
                  />
                )}
                {filters.view === 'multi' && (
                  <ReportChart
                    title="Approved leave ranking"
                    description="Named employee comparison, limited to the current authorized scope."
                    filename={`leave-ranking-${periodFilename}`}
                    option={rankingOption(leave.rankings.slice(0, 15).map((row) => ({ name: row.name, value: row.days })), 'Working days')}
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
              <DetailTable filters={filters} details={details} onNavigate={apply} />
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
                <ReportChart
                  title="Attendance calendar"
                  description="Issue-day intensity across the selected calendar period."
                  filename={`attendance-calendar-${periodFilename}`}
                  option={heatmapOption(attendance.heatmap, filters.start_date, filters.end_date)}
                />
                <ChartWithToggle modes={['donut', 'bar']} value={issueMode} onChange={(value) => setIssueMode(value as 'donut' | 'bar')}>
                  <ReportChart
                    title="Attendance issue mix"
                    description="Late arrivals, early departures, missing punches, and flagged events."
                    filename={`attendance-issues-${periodFilename}`}
                    option={issueOption}
                  />
                </ChartWithToggle>
                <ChartWithToggle modes={['scatter', 'boxplot']} value={varianceMode} onChange={(value) => setVarianceMode(value as 'scatter' | 'boxplot')}>
                  <ReportChart
                    title="Timing variance"
                    description="Minutes before or after each expected attendance milestone."
                    filename={`attendance-variance-${periodFilename}`}
                    option={varianceOption(attendance.variance, varianceMode)}
                  />
                </ChartWithToggle>
                {filters.view === 'multi' && (
                  <ReportChart
                    title="Employee attendance compliance"
                    description="Named compliance comparison, limited to the current authorized scope."
                    filename={`employee-attendance-${periodFilename}`}
                    option={rankingOption(attendance.employees.slice(0, 15).map((row) => ({ name: row.name, value: row.compliance })), 'Compliance %')}
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
              <DetailTable filters={filters} details={details} onNavigate={apply} />
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
    ['Available leave balance', `${summary.available_balance} days`, <CheckCircle2 size={17} />, 'teal'],
    ['Attendnace Compliance', `${summary.attendance_compliance}%`, <Activity size={17} />, 'blue'],
    ['Late / early', `${summary.late} / ${summary.early}`, <Clock3 size={17} />, 'purple'],
    ['Missing punches', summary.missing, <TriangleAlert size={17} />, 'red'],
    ['Issues', summary.unresolved_flags, <TriangleAlert size={17} />, 'red'],
  ];
  const visibleLabels = section === 'leave'
    ? ['Employees', 'Approved leave', 'Pending leave', 'Available balance']
    : section === 'attendance'
      ? ['Employees', 'Compliance', 'Late / early', 'Missing punches', 'Unresolved flags']
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

function DetailTable({ filters, details, onNavigate }: { filters: Filters; details: Props['details']; onNavigate: (patch: Partial<Filters>) => void }) {
  const sort = (key: string) => onNavigate({
    sort: key,
    direction: filters.sort === key && filters.direction === 'asc' ? 'desc' : 'asc',
    page: 1,
  });
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-neutral-900">Employee detail</h3>
          <p className="mt-1 text-xs text-neutral-500">{details.total} scoped employee records</p>
        </div>
        <select value={filters.per_page} onChange={(event) => onNavigate({ per_page: Number(event.target.value), page: 1 })} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs">
          <option value={10}>10 rows</option>
          <option value={25}>25 rows</option>
          <option value={50}>50 rows</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              {[
                ['name', 'Employee'],
                ['leave_days', 'Leave days'],
                ['available_balance', 'Available'],
                ['attendance_compliance', 'Compliance'],
                ['late', 'Late'],
                ['early', 'Early'],
                ['missing', 'Missing'],
              ].map(([key, label]) => (
                <th key={key} className="px-4 py-3">
                  <button type="button" onClick={() => sort(key)} className="font-semibold hover:text-orange-700">{label}{filters.sort === key ? (filters.direction === 'asc' ? ' ↑' : ' ↓') : ''}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {details.data.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50/70">
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-neutral-800">{row.name}</div>
                  <div className="mt-0.5 text-xs text-neutral-400">{row.employee_code ?? 'No code'} · {row.department}</div>
                </td>
                <td className="px-4 py-3.5">{row.leave_days}</td>
                <td className="px-4 py-3.5">{row.available_balance}</td>
                <td className="px-4 py-3.5">{row.attendance_compliance}%</td>
                <td className="px-4 py-3.5">{row.late}</td>
                <td className="px-4 py-3.5">{row.early}</td>
                <td className="px-4 py-3.5">{row.missing}</td>
              </tr>
            ))}
            {!details.data.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-400">No records match the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4 text-xs text-neutral-500">
        <span>Page {details.page} of {details.last_page}</span>
        <div className="flex gap-2">
          <button type="button" disabled={details.page <= 1} onClick={() => onNavigate({ page: details.page - 1 })} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold disabled:opacity-40">Previous</button>
          <button type="button" disabled={details.page >= details.last_page} onClick={() => onNavigate({ page: details.page + 1 })} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold disabled:opacity-40">Next</button>
        </div>
      </div>
    </section>
  );
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

function simpleLineOption(labels: string[], values: number[], name: string) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 25, top: 30, bottom: 55 },
    xAxis: { type: 'category', data: labels, axisLabel: { rotate: labels.length > 12 ? 35 : 0 } },
    yAxis: { type: 'value', minInterval: 1 },
    dataZoom: labels.length > 18 ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 6 }] : [],
    series: [{ name, type: 'line', smooth: true, areaStyle: { opacity: 0.12 }, data: values }],
  };
}

function rankingOption(rows: { name: string; value: number }[], valueName: string) {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 35, top: 25, bottom: 35 },
    xAxis: { type: 'value', name: valueName },
    yAxis: { type: 'category', data: sorted.map((row) => row.name), axisLabel: { width: 105, overflow: 'truncate' } },
    series: [{ type: 'bar', data: sorted.map((row) => row.value), label: { show: true, position: 'right' } }],
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

function varianceOption(rows: Props['attendance']['variance'], mode: 'scatter' | 'boxplot') {
  const types = ['morning_in', 'lunch_out', 'lunch_in', 'final_out'];
  if (mode === 'boxplot') {
    return {
      tooltip: { trigger: 'item' },
      grid: { left: 55, right: 25, top: 25, bottom: 55 },
      xAxis: { type: 'category', data: types.map(titleCase), axisLabel: { rotate: 20 } },
      yAxis: { type: 'value', name: 'Minutes from expected' },
      series: [{ type: 'boxplot', data: types.map((type) => boxplot(rows.filter((row) => row.type === type).map((row) => row.minutes))) }],
    };
  }
  return {
    tooltip: { trigger: 'item', formatter: (params: { seriesName: string; data: [string, number, string?] }) => `${params.data[2] ?? ''}<br/>${formatDate(params.data[0])}: ${params.data[1]} min` },
    legend: { top: 8 },
    grid: { left: 55, right: 25, top: 55, bottom: 55 },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'Minutes from expected' },
    series: types.map((type) => ({
      name: titleCase(type),
      type: 'scatter',
      symbolSize: 8,
      data: rows.filter((row) => row.type === type).map((row) => [row.date, row.minutes, row.employee]),
    })),
  };
}

function departmentOption(rows: Props['attendance']['departments'], radar: boolean) {
  if (radar) {
    const issueMax = Math.max(1, ...rows.flatMap((row) => [row.late, row.early, row.missing]));
    return {
      tooltip: {},
      legend: { bottom: 6 },
      radar: { indicator: [{ name: 'Compliance', max: 100 }, { name: 'Late', max: issueMax }, { name: 'Early', max: issueMax }, { name: 'Missing', max: issueMax }] },
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
      { name: 'Late', type: 'bar', data: rows.map((row) => row.late) },
      { name: 'Missing', type: 'bar', data: rows.map((row) => row.missing) },
    ],
  };
}

function boxplot(values: number[]): number[] {
  if (!values.length) return [0, 0, 0, 0, 0];
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number) => {
    const position = (sorted.length - 1) * p;
    const base = Math.floor(position);
    const remainder = position - base;
    return sorted[base + 1] !== undefined ? sorted[base] + remainder * (sorted[base + 1] - sorted[base]) : sorted[base];
  };
  return [sorted[0], quantile(0.25), quantile(0.5), quantile(0.75), sorted[sorted.length - 1]];
}

function periodFor(preset: string) {
  const end = new Date();
  const start = new Date(end);
  if (preset === 'month') start.setDate(1);
  if (preset === '30') start.setDate(end.getDate() - 29);
  if (preset === 'quarter') start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1);
  if (preset === 'year') start.setMonth(0, 1);
  return { start_date: localDate(start), end_date: localDate(end) };
}

function localDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
