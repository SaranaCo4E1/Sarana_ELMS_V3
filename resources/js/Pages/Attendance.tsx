import { Head, router, useForm } from '@inertiajs/react';
import {
  Building2, CalendarClock, CalendarDays, CheckCircle2, Clock3, Download, Edit3,
  FileDown, Maximize2, Plus, Printer, QrCode, RefreshCcw, ShieldCheck,
  List, LocateFixed, Wifi, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import AttendancePunchButton from '../Components/AttendancePunchButton';
import type { AttendancePunchPreview } from '../Components/AttendanceTimingNotice';
import AppLayout from '../Layouts/AppLayout';

type Event = {
  id: number;
  direction: 'in' | 'out';
  classification: string;
  effective_at: string;
  verification_status: 'clean' | 'flagged';
  flag_reasons?: string[];
  reviewed_at?: string | null;
  distance_meters?: number | null;
  accuracy_meters?: number | null;
  source: string;
  voided_at?: string | null;
};
type Slot = { id: number; type: string; expected_at: string; status: string; event?: Event | null };
type Day = {
  id: number;
  work_date: string;
  timezone: string;
  status: string;
  excuse_type?: string | null;
  user: { id: number; name: string; employee_code?: string | null; department?: { name: string } | null };
  primary_site?: { id: number; name: string } | null;
  slots: Slot[];
  events: Event[];
};
type Qr = { id: number; mode: 'static' | 'daily'; is_enabled: boolean; scan_url?: string; image_url?: string };
type Site = {
  id: number;
  name: string;
  code: string;
  timezone: string;
  latitude?: number | null;
  longitude?: number | null;
  acceptance_radius_meters: number;
  maximum_accuracy_meters: number;
  allowed_ip_ranges?: string[];
  is_active: boolean;
  qr_code?: Qr | null;
};
type Employee = { id: number; name: string; employee_code?: string | null; department?: { name: string } | null };
type TeamTodayEntry = { user: Employee; day?: Day | null };
type Schedule = {
  id: number;
  effective_from: string;
  work_start: string;
  lunch_start: string;
  lunch_end: string;
  work_end: string;
  user: Employee;
  primary_site: Site;
  allowed_sites: Site[];
};
type Props = {
  today?: Day | null;
  nextDirection?: 'in' | 'out' | null;
  punchCooldownUntil?: string | null;
  punchPreview?: AttendancePunchPreview | null;
  attendanceUnavailableReason?: string | null;
  personalRecord?: Day | null;
  selectedPersonalDate: string;
  recentRecords: Day[];
  historyRecords: Day[];
  selectedHistoryMonth: string;
  historyUsers: Employee[];
  selectedHistoryUser: Employee;
  teamToday: TeamTodayEntry[];
  records: Day[];
  selectedDate: string;
  recordUsers: Employee[];
  sites: Site[];
  schedules: Schedule[];
  manageableUsers: Employee[];
  currentIp: string;
  capabilities: { settings: boolean; all_records: boolean; team_records: boolean };
};
type AttendanceTab = 'overview' | 'history' | 'team' | 'sites' | 'schedules';

const slotLabels: Record<string, string> = {
  morning_in: 'Morning in',
  lunch_out: 'Lunch out',
  lunch_in: 'Lunch in',
  final_out: 'Final out',
};
const slotOrder = ['morning_in', 'lunch_out', 'lunch_in', 'final_out'];

const statusClass = (status: string) => {
  if (['complete', 'on_time', 'clean'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (['issues', 'late', 'early', 'missing', 'flagged'].includes(status)) return 'bg-amber-50 text-amber-800 border-amber-100';
  if (['on_leave', 'holiday', 'weekend'].includes(status)) return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-neutral-50 text-neutral-600 border-neutral-200';
};

const nonWorkingDayLabel = (day: Day): string | null => ({
  approved_leave: 'On leave',
  public_holiday: 'Public holiday',
  weekend: 'Weekend',
} as Record<string, string>)[day.excuse_type ?? ''] ?? null;

const isNonWorkingDay = (day: Day): boolean => Boolean(day.excuse_type);

export default function Attendance({ today, nextDirection, punchCooldownUntil, punchPreview, attendanceUnavailableReason, personalRecord, selectedPersonalDate, recentRecords, historyRecords, selectedHistoryMonth, historyUsers, selectedHistoryUser, teamToday, records, selectedDate, recordUsers, sites, schedules, manageableUsers, currentIp, capabilities }: Props) {
  const canManageRecords = capabilities.all_records || capabilities.team_records;
  const availableTabs = useMemo<AttendanceTab[]>(
    () => [
      'overview',
      'history',
      ...(canManageRecords ? ['team' as const] : []),
      ...(capabilities.settings ? ['sites' as const, 'schedules' as const] : []),
    ],
    [canManageRecords, capabilities.settings],
  );
  const [tab, setTab] = useState<AttendanceTab>(() => tabFromUrl(availableTabs));
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  useEffect(() => {
    const syncTabFromUrl = () => setTab(tabFromUrl(availableTabs));
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, [availableTabs]);

  useEffect(() => {
    if (!sites.some((site) => site.qr_code?.is_enabled && site.qr_code.mode === 'daily')) return;
    const timer = window.setInterval(() => router.reload({ only: ['sites'] }), 60_000);
    return () => window.clearInterval(timer);
  }, [sites]);

  return (
    <AppLayout>
      <Head title="Attendance" />
      <div className="space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            {/* <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Check-in / Check-out</p> */}
            <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Attendance</h1>
            <p className="mt-1 text-sm text-neutral-500">Daily records, branch verification, and attendance history.</p>
          </div>
          <div className="flex flex-col gap-2 sm:w-56 sm:items-end">
            <AttendancePunchButton
              direction={nextDirection}
              branchName={today?.primary_site?.name}
              cooldownUntil={punchCooldownUntil}
              preview={punchPreview}
              unavailableReason={attendanceUnavailableReason}
              className="w-full"
            />
            {(capabilities.all_records || capabilities.team_records) && (
              <a
                href={`/attendance/export?start_date=${monthStart()}&end_date=${todayDate()}`}
                className="hidden items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
              >
                <FileDown size={16} /> Export this month
              </a>
            )}
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
          {[
            ['overview', 'Today'],
            ['history', 'History'],
            ...(canManageRecords ? [['team', 'Team records']] : []),
            ...(capabilities.settings ? [['sites', 'Branches & QR'], ['schedules', 'Schedules']] : []),
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                const nextTab = key as AttendanceTab;
                setTab(nextTab);
                storeTabInUrl(nextTab);
              }}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${tab === key ? 'bg-orange-50 text-orange-800' : 'text-neutral-500 hover:bg-neutral-50'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'overview' && (
          <Overview
            today={today}
            selectedRecord={personalRecord}
            selectedDate={selectedPersonalDate}
            recentDays={recentRecords}
            teamToday={teamToday}
            showTeamToday={capabilities.team_records}
            onViewHistory={() => {
              setTab('history');
              storeTabInUrl('history');
            }}
          />
        )}
        {tab === 'history' && (
          <PersonalHistory
            records={historyRecords}
            selectedMonth={selectedHistoryMonth}
            users={historyUsers}
            selectedUser={selectedHistoryUser}
          />
        )}
        {tab === 'team' && canManageRecords && (
          <Records
            records={records}
            canManage={canManageRecords}
            employees={recordUsers}
            selectedDate={selectedDate}
          />
        )}
        {tab === 'sites' && capabilities.settings && (
          <Sites
            sites={sites}
            onAdd={() => { setEditingSite(null); setSiteModalOpen(true); }}
            onEdit={(site) => { setEditingSite(site); setSiteModalOpen(true); }}
          />
        )}
        {tab === 'schedules' && capabilities.settings && (
          <Schedules schedules={schedules} users={manageableUsers} sites={sites} />
        )}
      </div>
      {siteModalOpen && (
        <SiteForm
          key={editingSite?.id ?? 'new'}
          site={editingSite}
          currentIp={currentIp}
          onDone={() => { setSiteModalOpen(false); setEditingSite(null); }}
        />
      )}
    </AppLayout>
  );
}

function Overview({ today, selectedRecord, selectedDate, recentDays, teamToday, showTeamToday, onViewHistory }: {
  today?: Day | null;
  selectedRecord?: Day | null;
  selectedDate: string;
  recentDays: Day[];
  teamToday: TeamTodayEntry[];
  showTeamToday: boolean;
  onViewHistory: () => void;
}) {
  const workedMinutes = useLiveWorkedMinutes(today);

  if (!today) {
    return <Empty title="No active schedule" body="Ask HR to assign an attendance schedule and work branch." />;
  }

  const changePersonalDate = (date: Date | null) => {
    if (!date) return;
    router.get('/attendance', {
      tab: 'overview',
      personal_date: localDateString(date),
    }, {
      preserveScroll: true,
      preserveState: true,
      only: ['personalRecord', 'selectedPersonalDate'],
    });
  };
  const currentStatus = nonWorkingDayLabel(today) ?? dayPresence(today);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icon={currentStatus === 'Checked in' ? CheckCircle2 : Clock3} label="Current status" value={currentStatus} />
        <CountUpWorkedTime targetMinutes={workedMinutes} />
      </div>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-900">{selectedDate === todayDate() ? 'Today’s record' : 'Attendance record'}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {formatDate(selectedDate)}{selectedRecord ? ` · ${selectedRecord.timezone}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-neutral-600">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-400">View date</span>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" size={15} />
                <DatePicker
                  selected={parseDateOnly(selectedDate)}
                  onChange={changePersonalDate}
                  maxDate={new Date()}
                  filterDate={isWeekday}
                  dayClassName={attendanceDayClassName}
                  dateFormat="MMM d, yyyy"
                  className="w-44 rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-neutral-700"
                />
              </span>
            </label>
            {selectedRecord && <DayBadge day={selectedRecord} />}
          </div>
        </div>
        {selectedRecord
          ? <DayDetails day={selectedRecord} />
          : <Empty title="No attendance record" body={`No attendance was recorded on ${formatDate(selectedDate)}.`} />}
      </section>
      {showTeamToday && <TeamToday entries={teamToday} />}
      <PersonalDaysTable
        records={recentDays}
        title="Recent days"
        description="Your five most recent attendance days before today."
        emptyBody="Your previous attendance days will appear here."
        onViewMore={onViewHistory}
      />
    </div>
  );
}

type EmployeeOption = { value: number; label: string; employee: Employee };

function PersonalHistory({ records, selectedMonth, users, selectedUser }: {
  records: Day[];
  selectedMonth: string;
  users: Employee[];
  selectedUser: Employee;
}) {
  const [view, setView] = useState<'table' | 'calendar'>('calendar');
  const employeeOptions = useMemo<EmployeeOption[]>(
    () => users.map((employee) => ({
      value: employee.id,
      label: [
        employee.name,
        employee.employee_code,
        employee.department?.name,
      ].filter(Boolean).join(' · '),
      employee,
    })),
    [users],
  );

  const changeMonth = (date: Date | null) => {
    if (!date) return;
    router.get('/attendance', {
      tab: 'history',
      history_month: monthString(date),
      history_user_id: selectedUser.id,
    }, {
      preserveScroll: true,
      preserveState: true,
      only: ['historyRecords', 'selectedHistoryMonth', 'selectedHistoryUser'],
    });
  };

  const changeEmployee = (option: EmployeeOption | null) => {
    if (!option) return;
    router.get('/attendance', {
      tab: 'history',
      history_month: selectedMonth,
      history_user_id: option.value,
    }, {
      preserveScroll: true,
      preserveState: true,
      only: ['historyRecords', 'selectedHistoryMonth', 'selectedHistoryUser'],
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-100 p-5">
        <div>
          <h2 className="font-semibold text-neutral-900">Attendance history</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {records.length} attendance {records.length === 1 ? 'day' : 'days'} for {selectedUser.name} in {formatMonth(selectedMonth)}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {users.length > 1 && (
            <label className="min-w-64 flex-1 text-sm text-neutral-600 sm:flex-none">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-400">Team member</span>
              <Select<EmployeeOption>
                inputId="attendance-history-team-member"
                unstyled
                options={employeeOptions}
                value={employeeOptions.find((option) => option.value === selectedUser.id) ?? null}
                onChange={changeEmployee}
                isSearchable
                placeholder="Search team members..."
                noOptionsMessage={() => 'No team members found'}
                className="w-full sm:w-72"
                classNames={{
                  control: ({ isFocused }) => `min-h-10 rounded-lg border bg-white px-2.5 text-sm transition ${
                    isFocused ? 'border-orange-500 ring-4 ring-orange-500/5' : 'border-neutral-200'
                  }`,
                  valueContainer: () => 'gap-1 py-1',
                  placeholder: () => 'text-neutral-400',
                  singleValue: () => 'truncate font-medium text-neutral-700',
                  input: () => 'text-neutral-800',
                  indicatorsContainer: () => 'gap-1 text-neutral-400',
                  indicatorSeparator: () => 'bg-neutral-200',
                  dropdownIndicator: () => 'p-1',
                  menu: () => 'z-50 mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg',
                  menuList: () => 'max-h-64 p-1',
                  option: ({ isFocused, isSelected }) => `cursor-pointer rounded-md px-3 py-2.5 text-sm ${
                    isSelected ? 'bg-orange-600 text-white' : isFocused ? 'bg-orange-50 text-orange-900' : 'text-neutral-700'
                  }`,
                  noOptionsMessage: () => 'px-3 py-4 text-sm text-neutral-400',
                }}
              />
            </label>
          )}
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-400">View</span>
            <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
              {([
                ['calendar', CalendarDays, 'Calendar'],
                ['table', List, 'Table'],
              ] as const).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    view === value
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm text-neutral-600">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-400">Month</span>
            <DatePicker
              selected={parseDateOnly(`${selectedMonth}-01`)}
              onChange={changeMonth}
              maxDate={new Date()}
              dateFormat="MMMM yyyy"
              showMonthYearPicker
              showFullMonthYearPicker
              dayClassName={attendanceDayClassName}
              className="w-48 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700"
            />
          </label>
        </div>
      </div>
      {view === 'table' ? (
        <PersonalDaysTableBody
          records={records}
          emptyBody={`No attendance records were found for ${formatMonth(selectedMonth)}.`}
        />
      ) : (
        <PersonalHistoryCalendar records={records} selectedMonth={selectedMonth} />
      )}
    </section>
  );
}

function PersonalHistoryCalendar({ records, selectedMonth }: { records: Day[]; selectedMonth: string }) {
  const recordsByDate = useMemo(
    () => new Map(records.map((day) => [day.work_date.slice(0, 10), day])),
    [records],
  );
  const cells = useMemo(() => historyCalendarCells(selectedMonth), [selectedMonth]);
  const today = todayDate();

  return (
    <div className="overflow-x-auto bg-neutral-100">
      <div className="min-w-[700px] lg:min-w-0">
        <div className="grid grid-cols-7 gap-px border-b border-neutral-200 bg-neutral-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => (
            <div
              key={label}
              className={`bg-neutral-50 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide ${
                index === 0 || index === 6 ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-neutral-200">
          {cells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="min-h-28 bg-neutral-50/80" />;

            const day = recordsByDate.get(date);
            const isWeekend = index % 7 === 0 || index % 7 === 6;
            const isFuture = date > today;
            const slots = day ? orderedSlots(day.slots) : [];
            const worked = day ? workedDuration(day) : null;
            const dayLabel = day ? nonWorkingDayLabel(day) ?? day.status.replaceAll('_', ' ') : null;

            return (
              <div
                key={date}
                className={`relative min-h-28 p-2 ${
                  isWeekend ? 'bg-neutral-50' : 'bg-white'
                } ${date === today ? 'ring-2 ring-inset ring-orange-300' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    date === today
                      ? 'bg-orange-600 text-white'
                      : isWeekend ? 'text-neutral-400' : 'text-neutral-700'
                  }`}>
                    {Number(date.slice(-2))}
                  </span>
                  {day && (
                    <span
                      title={dayLabel ?? undefined}
                      className={`inline-flex h-5 min-w-0 items-center truncate rounded-full border px-1.5 text-[10px] font-semibold capitalize leading-none ${statusClass(day.status)}`}
                    >
                      {dayLabel}
                    </span>
                  )}
                </div>

                {day ? (
                  isNonWorkingDay(day) ? (
                    <p className="mt-4 text-xs font-medium text-blue-700">{dayLabel}</p>
                  ) : <>
                    {/* <p className="mt-1.5 truncate text-[10px] font-medium text-neutral-500" title={day.primary_site?.name ?? 'No branch'}>
                      {day.primary_site?.name ?? 'No branch'}
                    </p> */}
                    <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                      {slots.map((slot) => (
                        <div key={slot.id} className="flex min-w-0 items-center justify-between gap-1 text-[10px]">
                          <span className="truncate text-neutral-400">{calendarSlotLabel(slot.type)}</span>
                          <span className={`shrink-0 rounded font-semibold tabular-nums ${calendarSlotTone(slot.status)} ${
                            ['early', 'late'].includes(slot.status) ? 'bg-amber-100/80 px-1 py-0.5' : ''
                          }`}>
                            {slot.event ? formatTime(slot.event.effective_at, day.timezone) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 text-right text-[9px] font-bold tabular-nums text-neutral-700" title="Worked hours, excluding lunch break">
                      Worked {worked ?? '—'}
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-xs text-neutral-400">
                    {isWeekend ? 'Weekend' : isFuture ? '' : 'No attendance'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PersonalDaysTable({ records, title, description, emptyBody, onViewMore }: {
  records: Day[];
  title: string;
  description: string;
  emptyBody: string;
  onViewMore?: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-5">
        <div>
          <h2 className="font-semibold text-neutral-900">{title}</h2>
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        </div>
        {onViewMore && (
          <button
            type="button"
            onClick={onViewMore}
            className="rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-800"
          >
            View more
          </button>
        )}
      </div>
      <PersonalDaysTableBody records={records} emptyBody={emptyBody} />
    </section>
  );
}

function PersonalDaysTableBody({ records, emptyBody }: { records: Day[]; emptyBody: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full divide-y divide-neutral-100 text-left text-sm">
        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Branch</th>
            {slotOrder.map((type) => <th key={type} className="px-4 py-3">{slotLabels[type]}</th>)}
            <th className="px-4 py-3">Worked</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {records.map((day) => (
            <tr key={day.id} className="hover:bg-neutral-50/70">
              <td className="whitespace-nowrap px-5 py-4">
                <div className="font-medium text-neutral-900">{formatDate(day.work_date)}</div>
                <div className="mt-0.5 text-xs text-neutral-400">{weekday(day.work_date)}</div>
              </td>
              <td className="px-5 py-4 text-neutral-600">{day.primary_site?.name ?? 'No branch'}</td>
              {isNonWorkingDay(day)
                ? slotOrder.map((type) => <td key={type} className="whitespace-nowrap px-4 py-4 text-neutral-300">—</td>)
                : orderedSlots(day.slots).map((slot) => (
                  <td key={slot.id} className="whitespace-nowrap px-4 py-4">
                    <SlotValue slot={slot} timezone={day.timezone} hideOnTime />
                  </td>
                ))}
              <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums text-neutral-800" title="Lunch break excluded">
                {isNonWorkingDay(day) ? '—' : workedDuration(day) ?? '—'}
              </td>
              <td className="px-5 py-4"><DayBadge day={day} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 && <Empty title="No attendance days" body={emptyBody} />}
    </div>
  );
}

function DayDetails({ day }: { day: Day }) {
  if (isNonWorkingDay(day)) {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-5">
        <p className="text-sm font-semibold text-blue-800">{nonWorkingDayLabel(day)}</p>
        <p className="mt-1 text-sm text-blue-700">No attendance punches are required for this day.</p>
      </div>
    );
  }

  const worked = workedDuration(day);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {orderedSlots(day.slots).map((slot) => (
          <div key={slot.id} className={`rounded-xl border p-4 ${slot.status === 'missing' ? 'border-rose-200 bg-rose-50' : 'border-neutral-100 bg-neutral-50/50'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${slot.status === 'missing' ? 'text-rose-600' : 'text-neutral-400'}`}>{slotLabels[slot.type]}</p>
            <p className={`mt-3 text-xl font-semibold ${slot.status === 'missing' ? 'text-rose-800' : 'text-neutral-900'}`}>
              {slot.event ? formatTime(slot.event.effective_at, day.timezone) : '—'}
            </p>
            <div className="mt-3"><Badge status={slot.status} /></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-neutral-100 bg-neutral-50/70 px-4 py-3">
        <Clock3 size={16} className="text-orange-700" />
        <span className="text-sm font-medium text-neutral-600">Total worked</span>
        <strong className="text-sm tabular-nums text-neutral-900">{worked ?? '—'}</strong>
        <span className="text-xs text-neutral-400">
          {worked ? 'Lunch break excluded' : 'Available after all four punches'}
        </span>
      </div>
      {day.events.length > 0 && (
        <div className="mt-6 border-t border-neutral-100 pt-5">
          <h3 className="text-sm font-semibold text-neutral-800">Movement timeline</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {day.events.filter((event) => !event.voided_at).map((event) => (
              <span key={event.id} className={`rounded-lg border px-3 py-2 text-xs font-medium ${event.verification_status === 'flagged' ? statusClass('flagged') : 'border-neutral-200 bg-white text-neutral-600'}`}>
                {formatTime(event.effective_at, day.timezone)} · {event.direction.toUpperCase()} · {event.classification.replaceAll('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TeamToday({ entries }: { entries: TeamTodayEntry[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 p-5">
        <h2 className="font-semibold text-neutral-900">Team today</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Live check-in and check-out progress for your direct reports.
        </p>
      </div>
      {entries.length === 0 ? (
        <Empty title="No direct reports" body="Active employees reporting to you will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full divide-y divide-neutral-100 text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3">Team member</th>
                {slotOrder.map((type) => <th key={type} className="px-4 py-3">{slotLabels[type]}</th>)}
                <th className="px-4 py-3">Worked</th>
                <th className="px-4 py-3">Current status</th>
                <th className="px-5 py-3">Day status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {entries.map(({ user, day }) => (
                <tr key={user.id} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-neutral-900">{user.name}</div>
                    <div className="mt-0.5 text-xs text-neutral-400">
                      {[user.employee_code, user.department?.name].filter(Boolean).join(' · ') || 'No employee details'}
                    </div>
                  </td>
                  {day && isNonWorkingDay(day) ? slotOrder.map((type) => (
                    <td key={type} className="whitespace-nowrap px-4 py-4 text-neutral-300">—</td>
                  )) : day ? orderedSlots(day.slots).map((slot) => (
                    <td key={slot.id} className="whitespace-nowrap px-4 py-4">
                      <SlotValue slot={slot} timezone={day.timezone} />
                    </td>
                  )) : slotOrder.map((type) => (
                    <td key={type} className="whitespace-nowrap px-4 py-4 text-neutral-300">—</td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums text-neutral-800">
                    {day && !isNonWorkingDay(day) ? workedDurationToNow(day) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <PresenceBadge day={day} />
                  </td>
                  <td className="px-5 py-4">
                    {day ? <DayBadge day={day} /> : <span className="text-xs text-neutral-400">No active schedule</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PresenceBadge({ day }: { day?: Day | null }) {
  const presence = day ? nonWorkingDayLabel(day) ?? dayPresence(day) : 'Unavailable';
  const tone = ({
    'Checked in': 'border-emerald-100 bg-emerald-50 text-emerald-700',
    'On lunch': 'border-amber-100 bg-amber-50 text-amber-800',
    'Checked out': 'border-neutral-200 bg-neutral-50 text-neutral-600',
    'Not checked in': 'border-rose-100 bg-rose-50 text-rose-700',
    Unavailable: 'border-neutral-200 bg-neutral-50 text-neutral-400',
  } as Record<string, string>)[presence] ?? 'border-blue-100 bg-blue-50 text-blue-700';

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{presence}</span>;
}

function Records({ records, canManage, employees, selectedDate }: { records: Day[]; canManage: boolean; employees: Employee[]; selectedDate: string }) {
  const [query, setQuery] = useState('');
  const [employee, setEmployee] = useState('all');
  const [department, setDepartment] = useState('all');
  const [site, setSite] = useState('all');
  const [status, setStatus] = useState('all');
  const [eventAction, setEventAction] = useState<{ mode: 'correct' | 'resolve'; event: Event; timezone: string } | null>(null);
  const departments = useMemo(
    () => [...new Set(employees.map((item) => item.department?.name).filter((name): name is string => Boolean(name)))].sort(),
    [employees],
  );
  const recordSites = useMemo(
    () => [...new Map(records.filter((day) => day.primary_site).map((day) => [day.primary_site!.id, day.primary_site!])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    [records],
  );
  const showBranch = recordSites.length > 1;
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((day) =>
      (status === 'all' || day.status === status)
      && (employee === 'all' || day.user.id === Number(employee))
      && (department === 'all' || day.user.department?.name === department)
      && (!showBranch || site === 'all' || day.primary_site?.id === Number(site))
      && (!normalizedQuery || `${day.user.name} ${day.user.employee_code ?? ''}`.toLowerCase().includes(normalizedQuery))
    );
  }, [department, employee, query, records, showBranch, site, status]);

  const changeDate = (date: Date | null) => {
    if (!date) return;
    router.get('/attendance', {
      tab: 'team',
      attendance_date: localDateString(date),
    }, {
      preserveScroll: true,
      preserveState: true,
      only: ['records', 'selectedDate'],
    });
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-neutral-900">Team attendance</h2>
              <p className="mt-1 text-sm text-neutral-500">{filtered.length} of {records.length} staff records for {formatDate(selectedDate)}</p>
            </div>
            <label className="text-sm text-neutral-600">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-400">Record date</span>
              <DatePicker
                selected={parseDateOnly(selectedDate)}
                onChange={changeDate}
                maxDate={new Date()}
                filterDate={isWeekday}
                dayClassName={attendanceDayClassName}
                dateFormat="MMM d, yyyy"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                className="w-44 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700"
              />
            </label>
          </div>
          <div className={`mt-4 grid gap-3 ${
            canManage
              ? showBranch ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3'
              : 'sm:grid-cols-2'
          }`}>
            {canManage && <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff or code" className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm" />}
            {/* {canManage && (
              <select value={employee} onChange={(event) => setEmployee(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
                <option value="all">All staff</option>
                {employees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.employee_code ?? 'NO CODE'}</option>)}
              </select>
            )} */}
            {canManage && (
              <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
                <option value="all">All departments</option>
                {departments.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            {canManage && showBranch && (
              <select value={site} onChange={(event) => setSite(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
                <option value="all">All branches</option>
                {recordSites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            )}
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
              <option value="all">All statuses</option>
              <option value="issues">Issues</option>
              <option value="complete">Complete</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`${showBranch ? 'min-w-[1270px]' : 'min-w-[1120px]'} w-full divide-y divide-neutral-100 text-left text-sm`}>
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3">Staff</th>
                <th className="px-4 py-3">Department</th>
                {showBranch && <th className="px-4 py-3">Branch</th>}
                {slotOrder.map((type) => <th key={type} className="px-4 py-3">{slotLabels[type]}</th>)}
                <th className="px-4 py-3">Worked</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((day) => {
                const flaggedEvents = day.events.filter((event) => event.verification_status === 'flagged' && !event.reviewed_at && !event.voided_at);
                return (
                  <tr key={day.id} className="align-top hover:bg-neutral-50/70">
                    <td className="px-5 py-4">
                      <div className="font-medium text-neutral-900">{day.user.name}</div>
                      <div className="mt-0.5 text-xs text-neutral-400">{day.user.employee_code ?? 'NO CODE'}</div>
                    </td>
                    <td className="px-4 py-4 text-neutral-600">{day.user.department?.name ?? '—'}</td>
                    {showBranch && <td className="px-4 py-4 text-neutral-600">{day.primary_site?.name ?? 'No branch'}</td>}
                    {isNonWorkingDay(day)
                      ? slotOrder.map((type) => <td key={type} className="whitespace-nowrap px-4 py-4 text-neutral-300">—</td>)
                      : orderedSlots(day.slots).map((slot) => (
                        <td key={slot.id} className="whitespace-nowrap px-4 py-4">
                          <SlotValue slot={slot} timezone={day.timezone} hideOnTime />
                        </td>
                      ))}
                    <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums text-neutral-800" title="Lunch break excluded">
                      {isNonWorkingDay(day) ? '—' : workedDuration(day) ?? '—'}
                    </td>
                    <td className="px-4 py-4"><DayBadge day={day} /></td>
                    <td className="px-5 py-4 text-right">
                      {flaggedEvents.length === 0 ? (
                        <span className="text-xs text-neutral-400">No issues</span>
                      ) : (
                        <div className="space-y-2">
                          {flaggedEvents.map((event) => (
                            <div key={event.id} className="flex items-center justify-end gap-1.5">
                              <span className="mr-1 text-xs text-amber-800" title={(event.flag_reasons ?? []).map(formatFlagReason).join('; ')}>
                                {formatTime(event.effective_at, day.timezone)} flagged
                              </span>
                              {canManage && (
                                <>
                                  <button aria-label="Correct flagged event" onClick={() => setEventAction({ mode: 'correct', event, timezone: day.timezone })} className="rounded-md border border-amber-200 bg-white p-1.5 text-amber-800 hover:bg-amber-50"><Edit3 size={13} /></button>
                                  <button aria-label="Resolve flagged event" onClick={() => setEventAction({ mode: 'resolve', event, timezone: day.timezone })} className="rounded-md bg-amber-700 p-1.5 text-white hover:bg-amber-800"><ShieldCheck size={13} /></button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <Empty title="No attendance records" body="Try another date or adjust the filters." />}
        </div>
      </section>
      {eventAction?.mode === 'correct' && (
        <CorrectEventModal
          key={`correct-${eventAction.event.id}`}
          event={eventAction.event}
          timezone={eventAction.timezone}
          onDone={() => setEventAction(null)}
        />
      )}
      {eventAction?.mode === 'resolve' && (
        <ResolveEventModal
          key={`resolve-${eventAction.event.id}`}
          event={eventAction.event}
          timezone={eventAction.timezone}
          onDone={() => setEventAction(null)}
        />
      )}
    </div>
  );
}

function SlotValue({ slot, timezone, hideOnTime = false }: { slot: Slot; timezone: string; hideOnTime?: boolean }) {
  const tone = {
    late: 'text-amber-800',
    early: 'text-amber-800',
    missing: 'text-rose-700',
  }[slot.status] ?? 'text-neutral-700';

  return (
    <div className={tone}>
      <div className="font-semibold">{slot.event ? formatTime(slot.event.effective_at, timezone) : '—'}</div>
      {(!hideOnTime || slot.status !== 'on_time') && (
        <div className="mt-0.5 text-xs capitalize opacity-75">{slotTimingLabel(slot)}</div>
      )}
    </div>
  );
}

function CorrectEventModal({ event, timezone, onDone }: { event: Event; timezone: string; onDone: () => void }) {
  const { data, setData, patch, processing, errors } = useForm({
    direction: event.direction,
    effective_at: localInputValue(event.effective_at, timezone),
    void: Boolean(event.voided_at),
    reason: '',
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          patch(`/attendance/events/${event.id}`, { onSuccess: onDone });
        }}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 p-5">
          <div>
            <h2 className="font-semibold text-neutral-900">Correct attendance event</h2>
            <p className="mt-1 text-sm text-neutral-500">Update the recorded direction or time with an audit reason.</p>
          </div>
          <button type="button" onClick={onDone} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Close correction form"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm text-amber-900">
            Current event: {formatTime(event.effective_at, timezone)} {event.direction.toUpperCase()}
          </div>
          <label className="block text-sm text-neutral-600">
            Direction
            <select value={data.direction} onChange={(changeEvent) => setData('direction', changeEvent.target.value as 'in' | 'out')} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5">
              <option value="in">Check in</option>
              <option value="out">Check out</option>
            </select>
            {errors.direction && <span className="mt-1 block text-xs text-rose-600">{errors.direction}</span>}
          </label>
          <Field label={`Effective time (${timezone})`} type="datetime-local" value={data.effective_at} onChange={(value) => setData('effective_at', value)} error={errors.effective_at} />
          <label className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-sm text-neutral-600">
            <input type="checkbox" checked={data.void} onChange={(changeEvent) => setData('void', changeEvent.target.checked)} className="mt-0.5" />
            <span><span className="block font-medium text-neutral-800">Void this event</span><span className="mt-0.5 block text-xs text-neutral-500">The event remains in the audit trail but no longer affects attendance calculations.</span></span>
          </label>
          <label className="block text-sm text-neutral-600">
            Correction reason
            <textarea value={data.reason} onChange={(changeEvent) => setData('reason', changeEvent.target.value)} rows={4} placeholder="Explain what was verified and why this correction is needed" className="mt-1.5 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5" />
            {errors.reason && <span className="mt-1 block text-xs text-rose-600">{errors.reason}</span>}
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-neutral-100 p-5">
          <button type="button" onClick={onDone} disabled={processing} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600">Cancel</button>
          <button disabled={processing} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Edit3 size={15} /> {processing ? 'Saving…' : 'Save correction'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function ResolveEventModal({ event, timezone, onDone }: { event: Event; timezone: string; onDone: () => void }) {
  const { data, setData, patch, processing, errors } = useForm({ note: '' });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          patch(`/attendance/events/${event.id}/review`, { onSuccess: onDone });
        }}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 p-5">
          <div>
            <h2 className="font-semibold text-neutral-900">Resolve attendance flag</h2>
            <p className="mt-1 text-sm text-neutral-500">Confirm that you reviewed the evidence and record the outcome.</p>
          </div>
          <button type="button" onClick={onDone} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Close resolution form"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm text-amber-900">
            <div className="font-medium">{formatTime(event.effective_at, timezone)} {event.direction.toUpperCase()}</div>
            <div className="mt-1 text-xs">{(event.flag_reasons ?? []).map(formatFlagReason).join('; ')}</div>
          </div>
          <label className="block text-sm text-neutral-600">
            Resolution note
            <textarea value={data.note} onChange={(changeEvent) => setData('note', changeEvent.target.value)} rows={5} placeholder="Describe what you checked and why this flag can be resolved" className="mt-1.5 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5" autoFocus />
            {errors.note && <span className="mt-1 block text-xs text-rose-600">{errors.note}</span>}
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-neutral-100 p-5">
          <button type="button" onClick={onDone} disabled={processing} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600">Cancel</button>
          <button disabled={processing} className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><ShieldCheck size={15} /> {processing ? 'Resolving…' : 'Resolve flag'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Sites({ sites, onAdd, onEdit }: { sites: Site[]; onAdd: () => void; onEdit: (site: Site) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-neutral-900">Attendance branches</h2>
          <p className="mt-1 text-sm text-neutral-500">Manage branch verification and shared QR codes.</p>
        </div>
        <button onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white">
          <Plus size={15} /> Add branch
        </button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {sites.map((site) => (
          <section id={`attendance-qr-${site.id}`} key={site.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><Building2 size={17} className="text-orange-600" /><h3 className="font-semibold text-neutral-900">{site.name}</h3></div>
                <p className="mt-1 text-xs text-neutral-400">{site.code} · {site.timezone} · {site.acceptance_radius_meters}m radius</p>
              </div>
              <button onClick={() => onEdit(site)} aria-label={`Edit ${site.name}`} className="rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50"><Edit3 size={15} /></button>
            </div>
            {site.qr_code?.is_enabled && site.qr_code.image_url ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr]">
                <div id={`attendance-qr-fullscreen-${site.id}`} className="attendance-qr-fullscreen">
                  <img src={site.qr_code.image_url} alt={`${site.name} QR`} className="h-44 w-44 rounded-xl border border-neutral-200 bg-white p-2" />
                  <div className="attendance-qr-fullscreen-info hidden text-center">
                    <h2 className="text-3xl font-semibold text-neutral-900">{site.name}</h2>
                    <p className="mt-2 text-lg text-neutral-500">{site.code} · Scan to record attendance</p>
                    <p className="mt-1 text-sm text-neutral-400">{site.qr_code.mode === 'daily' ? `Valid ${todayDate()} in branch time` : 'Static attendance code'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Badge status={site.qr_code.mode} />
                  <p className="text-sm text-neutral-500">{site.qr_code.mode === 'daily' ? `Valid ${todayDate()} in branch time.` : 'Valid until regenerated or disabled.'}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => printQr(site)} className="button-secondary"><Printer size={14} /> Print</button>
                    <button onClick={() => downloadQr(site)} className="button-secondary"><Download size={14} /> PNG</button>
                    <button onClick={() => document.getElementById(`attendance-qr-fullscreen-${site.id}`)?.requestFullscreen()} className="button-secondary"><Maximize2 size={14} /> Full screen</button>
                    <button onClick={() => router.post(`/attendance/sites/${site.id}/regenerate-qr`)} className="button-secondary"><RefreshCcw size={14} /> Regenerate</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-400">QR attendance is disabled for this branch.</div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function SiteForm({ site, currentIp, onDone }: { site: Site | null; currentIp: string; onDone: () => void }) {
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const { data, setData, post, patch, transform, processing, errors, reset } = useForm({
    name: site?.name ?? '',
    code: site?.code ?? '',
    timezone: site?.timezone ?? 'Asia/Phnom_Penh',
    latitude: site?.latitude?.toString() ?? '',
    longitude: site?.longitude?.toString() ?? '',
    acceptance_radius_meters: site?.acceptance_radius_meters ?? 150,
    maximum_accuracy_meters: site?.maximum_accuracy_meters ?? 100,
    allowed_ip_ranges_text: (site?.allowed_ip_ranges ?? []).join('\n'),
    is_active: site?.is_active ?? true,
    qr_mode: site?.qr_code?.mode ?? 'daily',
    qr_enabled: site?.qr_code?.is_enabled ?? false,
  });

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processing) onDone();
    };
    document.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onDone, processing]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    transform((formData) => ({
      ...formData,
      latitude: formData.latitude || null,
      longitude: formData.longitude || null,
      allowed_ip_ranges: formData.allowed_ip_ranges_text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
    }));
    const options = {
      preserveScroll: true,
      onSuccess: () => { reset(); onDone(); },
    };
    site ? patch(`/attendance/sites/${site.id}`, options) : post('/attendance/sites', options);
  };

  const useCurrentIp = () => {
    if (!currentIp) return;
    const ranges = data.allowed_ip_ranges_text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    if (!ranges.includes(currentIp)) {
      setData('allowed_ip_ranges_text', [...ranges, currentIp].join('\n'));
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported by this browser.');
      return;
    }
    setLocating(true);
    setLocationMessage('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setData((formData) => ({
          ...formData,
          latitude: coords.latitude.toFixed(7),
          longitude: coords.longitude.toFixed(7),
        }));
        setLocationMessage(`Location captured with approximately ${Math.round(coords.accuracy)}m accuracy.`);
        setLocating(false);
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied. Allow location access and try again.',
          2: 'Your current location is unavailable.',
          3: 'Getting your location timed out. Please try again.',
        };
        setLocationMessage(messages[error.code] ?? 'Unable to get your current location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };
  const serverErrors = errors as Record<string, string>;
  const errorMessages = Array.from(new Set(Object.values(errors).filter(Boolean)));

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 px-4 py-6 backdrop-blur-sm animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !processing) onDone();
      }}
    >
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-neutral-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id="site-form-title" className="font-semibold text-neutral-900">{site ? 'Edit branch' : 'Add attendance branch'}</h2>
            <p className="mt-1 text-sm text-neutral-500">Configure geofence, network, and shared QR.</p>
          </div>
          <button type="button" onClick={onDone} disabled={processing} aria-label="Close branch form" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 sm:p-6">
          {errorMessages.length > 0 && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
              <p className="font-semibold">Please fix the following:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {errorMessages.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Branch name" value={data.name} onChange={(value) => setData('name', value)} error={errors.name} />
            <Field label="Code" value={data.code} onChange={(value) => setData('code', value.toUpperCase())} error={errors.code} />
            <Field label="Timezone" value={data.timezone} onChange={(value) => setData('timezone', value)} error={errors.timezone} />
            <Field label="Radius (meters)" type="number" value={String(data.acceptance_radius_meters)} onChange={(value) => setData('acceptance_radius_meters', Number(value))} error={errors.acceptance_radius_meters} />
            <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
              <div>
                <p className="text-sm font-medium text-neutral-600">GPS coordinates</p>
                {locationMessage && <p className="mt-1 text-xs text-neutral-500" role="status">{locationMessage}</p>}
              </div>
              <button type="button" onClick={useCurrentLocation} disabled={locating} className="button-secondary">
                <LocateFixed size={14} className={locating ? 'animate-pulse' : ''} /> {locating ? 'Getting location…' : 'Use my current location'}
              </button>
            </div>
            <Field label="Latitude" type="number" value={data.latitude} onChange={(value) => setData('latitude', value)} error={errors.latitude} />
            <Field label="Longitude" type="number" value={data.longitude} onChange={(value) => setData('longitude', value)} error={errors.longitude} />
            <Field label="Max accuracy (meters)" type="number" value={String(data.maximum_accuracy_meters)} onChange={(value) => setData('maximum_accuracy_meters', Number(value))} error={errors.maximum_accuracy_meters} />
            <label className="text-sm text-neutral-600">QR mode<select value={data.qr_mode} onChange={(e) => setData('qr_mode', e.target.value as 'daily' | 'static')} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5"><option value="daily">Changes daily</option><option value="static">Static</option></select>{errors.qr_mode && <span className="mt-1 block text-xs text-rose-600">{errors.qr_mode}</span>}</label>
          </div>
          <label className="mt-4 block text-sm text-neutral-600">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>Allowed public IP/CIDR ranges</span>
              <button type="button" onClick={useCurrentIp} disabled={!currentIp} className="button-secondary">
                <Wifi size={14} /> Use my current IP{currentIp ? ` (${currentIp})` : ''}
              </button>
            </span>
            <textarea value={data.allowed_ip_ranges_text} onChange={(e) => setData('allowed_ip_ranges_text', e.target.value)} rows={3} placeholder="203.0.113.10&#10;2001:db8::/48" className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5" />
            {(serverErrors.allowed_ip_ranges || serverErrors['allowed_ip_ranges.0']) && <span className="mt-1 block text-xs text-rose-600">{serverErrors.allowed_ip_ranges || serverErrors['allowed_ip_ranges.0']}</span>}
          </label>
          <div className="mt-4 flex flex-wrap gap-5 text-sm text-neutral-600">
            <label className="flex items-center gap-2"><input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} /> Active branch</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={data.qr_enabled} onChange={(e) => setData('qr_enabled', e.target.checked)} /> Enable QR</label>
          </div>
          {errors.qr_enabled && <span className="mt-2 block text-xs text-rose-600">{errors.qr_enabled}</span>}
          <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 pt-5">
            <button type="button" onClick={onDone} disabled={processing} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">Cancel</button>
            <button disabled={processing} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Plus size={15} /> {processing ? 'Saving…' : site ? 'Save branch' : 'Create branch'}</button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Schedules({ schedules, users, sites }: { schedules: Schedule[]; users: Employee[]; sites: Site[] }) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [site, setSite] = useState('all');
  const [timing, setTiming] = useState('all');
  const [editing, setEditing] = useState<Schedule | null>(null);
  const departments = useMemo(
    () => [...new Set(users.map((user) => user.department?.name).filter((name): name is string => Boolean(name)))].sort(),
    [users],
  );
  const currentSchedules = useMemo(() => {
    const byUser = new Map<number, Schedule[]>();
    schedules.forEach((schedule) => byUser.set(schedule.user.id, [...(byUser.get(schedule.user.id) ?? []), schedule]));

    return users.map((user) => {
      const versions = (byUser.get(user.id) ?? []).sort((a, b) =>
        b.effective_from.localeCompare(a.effective_from) || b.id - a.id
      );
      return versions.find((schedule) => schedule.effective_from.slice(0, 10) <= todayDate()) ?? versions.at(-1) ?? null;
    }).filter((schedule): schedule is Schedule => schedule !== null);
  }, [schedules, users]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return currentSchedules.filter((schedule) => {
      const isFuture = schedule.effective_from.slice(0, 10) > todayDate();
      return (!normalizedQuery || `${schedule.user.name} ${schedule.user.employee_code ?? ''}`.toLowerCase().includes(normalizedQuery))
        && (department === 'all' || schedule.user.department?.name === department)
        && (site === 'all' || schedule.primary_site.id === Number(site))
        && (timing === 'all' || (timing === 'future') === isFuture);
    });
  }, [currentSchedules, department, query, site, timing]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 p-5">
          <h2 className="font-semibold text-neutral-900">Staff schedules</h2>
          <p className="mt-1 text-sm text-neutral-500">Review and update each employee&apos;s current attendance schedule.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff or code" className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm" />
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
              <option value="all">All departments</option>
              {departments.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={site} onChange={(event) => setSite(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
              <option value="all">All primary branches</option>
              {sites.map((attendanceSite) => <option key={attendanceSite.id} value={attendanceSite.id}>{attendanceSite.name}</option>)}
            </select>
            <select value={timing} onChange={(event) => setTiming(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
              <option value="all">All effective dates</option>
              <option value="current">Current</option>
              <option value="future">Future</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-100 text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3">Staff</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Primary branch</th>
                <th className="px-5 py-3">Work hours</th>
                <th className="px-5 py-3">Effective from</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-neutral-50/70">
                  <td className="px-5 py-4"><div className="font-medium text-neutral-900">{schedule.user.name}</div><div className="mt-0.5 text-xs text-neutral-400">{schedule.user.employee_code ?? 'NO CODE'}</div></td>
                  <td className="px-5 py-4 text-neutral-600">{schedule.user.department?.name ?? '—'}</td>
                  <td className="px-5 py-4 text-neutral-600">{schedule.primary_site.name}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-neutral-600">{shortTime(schedule.work_start)}–{shortTime(schedule.lunch_start)} / {shortTime(schedule.lunch_end)}–{shortTime(schedule.work_end)}</td>
                  <td className="whitespace-nowrap px-5 py-4"><Badge status={schedule.effective_from.slice(0, 10) > todayDate() ? 'future' : 'current'} /><div className="mt-1 text-xs text-neutral-400">{formatDate(schedule.effective_from)}</div></td>
                  <td className="px-5 py-4 text-right"><button onClick={() => setEditing(schedule)} className="button-secondary ml-auto"><Edit3 size={14} /> Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <Empty title="No schedules found" body="Try changing the schedule filters." />}
        </div>
      </section>
      {editing && <ScheduleEditForm key={editing.id} schedule={editing} sites={sites} onDone={() => setEditing(null)} />}
    </div>
  );
}

function ScheduleEditForm({ schedule, sites, onDone }: { schedule: Schedule; sites: Site[]; onDone: () => void }) {
  const { data, setData, patch, processing, errors } = useForm({
    primary_site_id: schedule.primary_site.id,
    allowed_site_ids: schedule.allowed_sites.map((site) => site.id),
    work_start: shortTime(schedule.work_start),
    lunch_start: shortTime(schedule.lunch_start),
    lunch_end: shortTime(schedule.lunch_end),
    work_end: shortTime(schedule.work_end),
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-sm">
      <form onSubmit={(event) => { event.preventDefault(); patch(`/attendance/schedules/${schedule.id}`, { onSuccess: onDone }); }} className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-neutral-100 p-5">
          <div><h2 className="font-semibold text-neutral-900">Edit staff schedule</h2><p className="mt-1 text-sm text-neutral-500">{schedule.user.name} · effective {formatDate(schedule.effective_from)}</p></div>
          <button type="button" onClick={onDone} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"><X size={18} /></button>
        </div>
        <div className="space-y-5 p-5">
          <label className="block text-sm text-neutral-600">Primary branch<select value={data.primary_site_id} onChange={(event) => setData('primary_site_id', Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5">{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select>{errors.primary_site_id && <span className="mt-1 block text-xs text-rose-600">{errors.primary_site_id}</span>}</label>
          <label className="block text-sm text-neutral-600">Allowed branches<div className="mt-2 grid gap-2 sm:grid-cols-2">{sites.map((site) => <label key={site.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 p-2.5"><input type="checkbox" checked={data.allowed_site_ids.includes(site.id) || data.primary_site_id === site.id} disabled={data.primary_site_id === site.id} onChange={(event) => setData('allowed_site_ids', event.target.checked ? [...data.allowed_site_ids, site.id] : data.allowed_site_ids.filter((id) => id !== site.id))} />{site.name}</label>)}</div></label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Work start" type="time" value={data.work_start} onChange={(value) => setData('work_start', value)} error={errors.work_start} />
            <Field label="Lunch start" type="time" value={data.lunch_start} onChange={(value) => setData('lunch_start', value)} error={errors.lunch_start} />
            <Field label="Lunch end" type="time" value={data.lunch_end} onChange={(value) => setData('lunch_end', value)} error={errors.lunch_end} />
            <Field label="Work end" type="time" value={data.work_end} onChange={(value) => setData('work_end', value)} error={errors.work_end} />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-neutral-100 p-5">
          <button type="button" onClick={onDone} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-600">Cancel</button>
          <button disabled={processing} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><CalendarClock size={15} /> {processing ? 'Saving…' : 'Save schedule'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({ label, value, onChange, type = 'text', error }: { label: string; value: string; onChange: (value: string) => void; type?: string; error?: string }) {
  return <label className="block text-sm text-neutral-600">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5" />{error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}</label>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon size={17} /></div><p className="mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 text-lg font-semibold text-neutral-900">{value}</p></div>;
}

function CountUpWorkedTime({ targetMinutes }: { targetMinutes: number }) {
  const [displayMinutes, setDisplayMinutes] = useState(0);

  useEffect(() => {
    const from = displayMinutes;
    const startedAt = performance.now();
    const duration = 850;
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayMinutes(Math.round(from + ((targetMinutes - from) * eased)));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [targetMinutes]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
        <Clock3 size={17} />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">Total time worked today</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900" aria-live="polite">
        {displayMinutes === 0 ? '—' : formatWorkedMinutes(displayMinutes)}
      </p>
    </div>
  );
}

function useLiveWorkedMinutes(day?: Day | null): number {
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return day ? workedMinutesToNow(day, clock) : 0;
}

function Badge({ status }: { status: string }) {
  return <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold leading-none capitalize ${statusClass(status)}`}>{status.replaceAll('_', ' ')}</span>;
}

function DayBadge({ day }: { day: Day }) {
  const label = nonWorkingDayLabel(day) ?? day.status.replaceAll('_', ' ');

  return <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold leading-none capitalize ${statusClass(day.status)}`}>{label}</span>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="p-10 text-center"><QrCode className="mx-auto text-neutral-300" size={30} /><h3 className="mt-3 font-medium text-neutral-700">{title}</h3><p className="mt-1 text-sm text-neutral-400">{body}</p></div>;
}

function printQr(site: Site) {
  if (!site.qr_code?.image_url) return;
  const popup = window.open('', '_blank', 'width=720,height=820');
  popup?.document.write(`<html><head><title>${site.name} Attendance QR</title><style>body{font-family:Arial;text-align:center;padding:40px}img{width:520px;max-width:90%}p{color:#666}</style></head><body><h1>${site.name}</h1><p>Scan to record attendance · ${site.qr_code.mode === 'daily' ? `Valid ${todayDate()}` : 'Static code'}</p><img src="${site.qr_code.image_url}" onload="window.print()"></body></html>`);
  popup?.document.close();
}

async function downloadQr(site: Site) {
  if (!site.qr_code?.image_url) return;
  const svg = await fetch(site.qr_code.image_url).then((response) => response.blob());
  const objectUrl = URL.createObjectURL(svg);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1200;
    canvas.getContext('2d')?.drawImage(image, 0, 0, 1200, 1200);
    const link = document.createElement('a');
    link.download = `${site.code}-${site.qr_code?.mode === 'daily' ? todayDate() : 'static'}-attendance.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    URL.revokeObjectURL(objectUrl);
  };
  image.src = objectUrl;
}

function todayDate() { return new Date().toLocaleDateString('en-CA'); }
function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function monthString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function parseDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}
function historyCalendarCells(selectedMonth: string): Array<string | null> {
  const [year, month] = selectedMonth.split('-').map(Number);
  const leadingDays = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: leadingDays }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${selectedMonth}-${String(day).padStart(2, '0')}`);
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function calendarSlotLabel(type: string) {
  return ({
    morning_in: 'In',
    lunch_out: 'Lunch',
    lunch_in: 'Back',
    final_out: 'Out',
  } as Record<string, string>)[type] ?? slotLabels[type] ?? type.replaceAll('_', ' ');
}
function calendarSlotTone(status: string) {
  if (['early', 'late'].includes(status)) return 'font-bold text-amber-900';
  if (status === 'missing') return 'text-rose-700';
  return 'text-neutral-700';
}
function isWeekday(date: Date) { return date.getDay() !== 0 && date.getDay() !== 6; }
function attendanceDayClassName(date: Date) { return isWeekday(date) ? '' : 'attendance-calendar-weekend'; }
function monthStart() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)); }
function formatMonth(value: string) { return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`)); }
function weekday(value: string) { return new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)); }
function formatTime(value: string, timezone: string) { return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(value)); }
function shortTime(value: string) { return value.slice(0, 5); }
function orderedSlots(slots: Slot[]) {
  return [...slots].sort((left, right) => slotOrder.indexOf(left.type) - slotOrder.indexOf(right.type));
}
function workedDuration(day: Day): string | null {
  const slots = new Map(day.slots.map((slot) => [slot.type, slot]));
  const morningIn = slots.get('morning_in')?.event?.effective_at;
  const lunchOut = slots.get('lunch_out')?.event?.effective_at;
  const lunchIn = slots.get('lunch_in')?.event?.effective_at;
  const finalOut = slots.get('final_out')?.event?.effective_at;
  if (!morningIn || !lunchOut || !lunchIn || !finalOut) return null;

  const morningMinutes = (new Date(lunchOut).getTime() - new Date(morningIn).getTime()) / 60_000;
  const afternoonMinutes = (new Date(finalOut).getTime() - new Date(lunchIn).getTime()) / 60_000;
  if (morningMinutes < 0 || afternoonMinutes < 0) return null;

  const totalMinutes = Math.round(morningMinutes + afternoonMinutes);
  return formatWorkedMinutes(totalMinutes);
}
function workedMinutesToNow(day: Day, now = Date.now()): number {
  const slots = new Map(day.slots.map((slot) => [slot.type, slot]));
  const morningIn = slots.get('morning_in')?.event?.effective_at;
  const lunchOut = slots.get('lunch_out')?.event?.effective_at;
  const lunchIn = slots.get('lunch_in')?.event?.effective_at;
  const finalOut = slots.get('final_out')?.event?.effective_at;
  const presence = dayPresence(day);
  let minutes = 0;

  if (morningIn && lunchOut) {
    minutes += elapsedMinutes(morningIn, lunchOut);
  } else if (morningIn && presence === 'Checked in' && !lunchIn) {
    minutes += elapsedMinutes(morningIn, now);
  }

  if (lunchIn && finalOut) {
    minutes += elapsedMinutes(lunchIn, finalOut);
  } else if (lunchIn && presence === 'Checked in') {
    minutes += elapsedMinutes(lunchIn, now);
  }

  return Math.max(0, Math.round(minutes));
}
function workedDurationToNow(day: Day): string {
  return formatWorkedMinutes(workedMinutesToNow(day));
}
function elapsedMinutes(start: string, end: string | number): number {
  const endTime = typeof end === 'number' ? end : new Date(end).getTime();
  return Math.max(0, (endTime - new Date(start).getTime()) / 60_000);
}
function formatWorkedMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
function dayPresence(day: Day): 'Checked in' | 'On lunch' | 'Checked out' | 'Not checked in' {
  const latest = day.events.filter((event) => !event.voided_at).at(-1);
  if (!latest) return 'Not checked in';
  if (latest.direction === 'in') return 'Checked in';
  if (latest.classification === 'lunch_out') return 'On lunch';
  return 'Checked out';
}
function slotTimingLabel(slot: Slot) {
  if (!slot.event || !['early', 'late'].includes(slot.status)) {
    return slot.status.replaceAll('_', ' ');
  }

  const differenceSeconds = Math.abs(
    new Date(slot.event.effective_at).getTime() - new Date(slot.expected_at).getTime(),
  ) / 1000;
  if (differenceSeconds < 60) return `<1 min ${slot.status}`;

  const differenceMinutes = Math.round(differenceSeconds / 60);
  const hours = Math.floor(differenceMinutes / 60);
  const minutes = differenceMinutes % 60;
  const duration = hours > 0
    ? `${hours} hr${hours === 1 ? '' : 's'}${minutes > 0 ? ` ${minutes} min` : ''}`
    : `${differenceMinutes} min`;

  return `${duration} ${slot.status}`;
}
function formatFlagReason(reason: string) {
  return ({
    denied: 'Location permission was denied',
    unavailable: 'Location could not be determined',
    timeout: 'Location request timed out',
    low_accuracy: 'Location accuracy was too low',
    outside_geofence: 'Location was outside the branch boundary',
    not_allowed: 'Network IP was outside this branch’s allowed ranges',
    not_configured: 'No allowed network range was configured',
    unassigned_site: 'This branch was not assigned to the employee',
  } as Record<string, string>)[reason] ?? reason.replaceAll('_', ' ');
}
function localInputValue(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function tabFromUrl(availableTabs: AttendanceTab[]): AttendanceTab {
  if (typeof window === 'undefined') return 'overview';
  const rawTab = new URL(window.location.href).searchParams.get('tab');
  const requestedTab = (rawTab === 'records'
    ? (availableTabs.includes('team') ? 'team' : 'history')
    : rawTab) as AttendanceTab | null;
  return requestedTab && availableTabs.includes(requestedTab) ? requestedTab : 'overview';
}

function storeTabInUrl(tab: AttendanceTab) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.pushState({}, '', url);
}
