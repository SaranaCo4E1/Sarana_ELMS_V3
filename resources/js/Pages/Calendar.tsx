import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, StickyNote, Umbrella } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest } from '../types';

type Holiday = { id: number; name: string; holiday_date: string };
type Props = {
  leaveEvents: LeaveRequest[];
  holidays: Holiday[];
  scopeLabel: string;
};

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
};

export default function Calendar({ leaveEvents, holidays, scopeLabel }: Props) {
  const todayKey = dateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const upcomingLeave = leaveEvents.filter((event) => parseDateKey(toDateKey(event.ends_at)) >= startOfToday()).slice(0, 12);
  const upcomingHolidays = holidays.filter((holiday) => parseDateKey(toDateKey(holiday.holiday_date)) >= startOfToday()).slice(0, 12);
  const monthGroups = groupByMonth([...leaveEvents.map((event) => ({ kind: 'leave' as const, date: event.starts_at, event })), ...holidays.map((holiday) => ({ kind: 'holiday' as const, date: holiday.holiday_date, holiday }))]);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth, leaveEvents, holidays), [visibleMonth, leaveEvents, holidays]);
  const selectedItems = calendarDays.find((day) => day.key === selectedDay)?.items ?? itemsForDate(selectedDay, leaveEvents, holidays);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Calendar</h2>
            <p className="text-sm text-slate-500">{scopeLabel} for leave, holidays, and upcoming coverage.</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <CalendarDays size={17} /> {leaveEvents.length} leave item(s) · {holidays.length} holiday(s)
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="font-semibold text-slate-950">{visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
                  <div className="text-sm text-slate-500">Leave, holidays, and day notes</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100" type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} aria-label="Previous month">
                    <ChevronLeft size={17} />
                  </button>
                  <button className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" type="button" onClick={() => { const now = new Date(); setVisibleMonth(startOfMonth(now)); setSelectedDay(dateKey(now)); }}>
                    Today
                  </button>
                  <button className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100" type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} aria-label="Next month">
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="px-2 py-3">{day}</div>)}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day) => (
                  <button
                    key={day.key}
                    className={`min-h-32 border-b border-r border-slate-100 p-2 text-left last:border-r-0 hover:bg-slate-50 ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50/70 text-slate-400'} ${day.key === selectedDay ? 'ring-2 ring-inset ring-sky-500' : ''}`}
                    type="button"
                    onClick={() => setSelectedDay(day.key)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${day.key === todayKey ? 'bg-slate-950 text-white' : 'text-slate-700'}`}>
                        {day.date.getDate()}
                      </span>
                      {day.items.length > 0 && <span className="text-xs text-slate-400">{day.items.length}</span>}
                    </div>
                    <div className="space-y-1">
                      {day.items.slice(0, 3).map((item) => (
                        <div key={item.id} className={`truncate rounded px-2 py-1 text-xs font-medium ${item.kind === 'holiday' ? 'bg-emerald-100 text-emerald-800' : item.status === 'approved' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                          {item.title}
                        </div>
                      ))}
                      {day.items.length > 3 && <div className="text-xs text-slate-400">+{day.items.length - 3} more</div>}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4 font-semibold">Monthly Timeline</div>
              <div className="divide-y divide-slate-100">
                {monthGroups.map((group) => (
                  <div key={group.month} className="grid gap-4 px-5 py-5 md:grid-cols-[150px_1fr]">
                    <div className="text-sm font-semibold text-slate-950">{group.month}</div>
                    <div className="space-y-3">
                      {group.items.map((item) => item.kind === 'leave' ? <LeaveRow key={`leave-${item.event.id}`} event={item.event} /> : <HolidayRow key={`holiday-${item.holiday.id}`} holiday={item.holiday} />)}
                    </div>
                  </div>
                ))}
                {monthGroups.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">No calendar items yet.</div>}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <Panel icon={<StickyNote size={18} />} title={formatSelectedDay(selectedDay)} empty="No notes for this day.">
              {selectedItems.map((item) => item.kind === 'leave'
                ? <LeaveNote key={item.id} item={item} />
                : <HolidayNote key={item.id} item={item} />)}
            </Panel>
            <Panel icon={<Umbrella size={18} />} title="Who's On Leave" empty="No upcoming leave.">
              {upcomingLeave.map((event) => <LeaveRow key={event.id} event={event} compact />)}
            </Panel>
            <Panel icon={<CalendarClock size={18} />} title="Upcoming Holidays" empty="No upcoming holidays.">
              {upcomingHolidays.map((holiday) => <HolidayRow key={holiday.id} holiday={holiday} compact />)}
            </Panel>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

type CalendarItem =
  | { id: string; kind: 'leave'; title: string; status: string; date: string; event: LeaveRequest }
  | { id: string; kind: 'holiday'; title: string; date: string; holiday: Holiday };

type CalendarDay = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  items: CalendarItem[];
};

function LeaveRow({ event, compact = false }: { event: LeaveRequest; compact?: boolean }) {
  return (
    <div className={`rounded-md border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-950">{event.user?.name ?? 'Employee'}</div>
          <div className="text-sm text-slate-500">{event.leave_type.name} · {formatDate(event.starts_at)} to {formatDate(event.ends_at)}</div>
          {event.user?.department?.name && <div className="mt-1 text-xs text-slate-400">{event.user.department.name}</div>}
        </div>
        <span className={`rounded-md px-2 py-1 text-xs ${statusStyles[event.status] ?? 'bg-slate-100 text-slate-600'}`}>{event.status}</span>
      </div>
    </div>
  );
}

function HolidayRow({ holiday, compact = false }: { holiday: Holiday; compact?: boolean }) {
  return <div className={`rounded-md border border-emerald-100 bg-emerald-50 ${compact ? 'p-3' : 'p-4'}`}><div className="font-medium text-emerald-950">{holiday.name}</div><div className="text-sm text-emerald-700">{formatDate(holiday.holiday_date)}</div></div>;
}

function Panel({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode[] }) {
  return <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center gap-2 font-semibold">{icon}{title}</div><div className="space-y-3">{children.length > 0 ? children : <p className="text-sm text-slate-500">{empty}</p>}</div></div>;
}

function LeaveNote({ item }: { item: Extract<CalendarItem, { kind: 'leave' }> }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-950">{item.event.user?.name ?? 'Employee'}</div>
          <div className="text-sm text-slate-500">{item.event.leave_type.name} · {formatDate(item.event.starts_at)} to {formatDate(item.event.ends_at)}</div>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs ${statusStyles[item.status] ?? 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
      </div>
      {item.event.reason && <div className="mt-2 text-sm text-slate-600">{item.event.reason}</div>}
    </div>
  );
}

function HolidayNote({ item }: { item: Extract<CalendarItem, { kind: 'holiday' }> }) {
  return <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3"><div className="font-medium text-emerald-950">{item.holiday.name}</div><div className="text-sm text-emerald-700">{formatDate(item.holiday.holiday_date)}</div></div>;
}

function buildCalendarDays(month: Date, leaveEvents: LeaveRequest[], holidays: Holiday[]): CalendarDay[] {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const key = dateKey(date);

    return {
      key,
      date,
      isCurrentMonth: date.getMonth() === month.getMonth(),
      items: itemsForDate(key, leaveEvents, holidays),
    };
  });
}

function itemsForDate(key: string, leaveEvents: LeaveRequest[], holidays: Holiday[]): CalendarItem[] {
  return [
    ...holidays
      .filter((holiday) => toDateKey(holiday.holiday_date) === key)
      .map((holiday) => ({
        id: `holiday-${holiday.id}`,
        kind: 'holiday' as const,
        title: holiday.name,
        date: toDateKey(holiday.holiday_date),
        holiday,
      })),
    ...leaveEvents
      .filter((event) => key >= toDateKey(event.starts_at) && key <= toDateKey(event.ends_at))
      .map((event) => ({
        id: `leave-${event.id}`,
        kind: 'leave' as const,
        title: event.user?.name ?? event.leave_type.name,
        status: event.status,
        date: toDateKey(event.starts_at),
        event,
      })),
  ];
}

function groupByMonth(items: Array<{ kind: 'leave'; date: string; event: LeaveRequest } | { kind: 'holiday'; date: string; holiday: Holiday }>) {
  const groups = new Map<string, typeof items>();
  items.sort((a, b) => parseDateKey(a.date).getTime() - parseDateKey(b.date).getTime()).forEach((item) => {
    const month = parseDateKey(item.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    groups.set(month, [...(groups.get(month) ?? []), item]);
  });
  return Array.from(groups, ([month, groupedItems]) => ({ month, items: groupedItems }));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSelectedDay(value: string) {
  return parseDateKey(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function toDateKey(value: string) {
  return value.slice(0, 10);
}

function parseDateKey(value: string) {
  const [year, month, day] = toDateKey(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  return parseDateKey(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
