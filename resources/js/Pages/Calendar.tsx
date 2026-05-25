import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, StickyNote, Umbrella } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '../Layouts/AppLayout';
import type { LeaveRequest } from '../types';
import { formatDays, formatShortDate, formatDate } from '../utils';
import LeaveBadge from '../Components/LeaveBadge';

type Holiday = { id: number; name: string; holiday_date: string };
type Props = {
  leaveEvents: LeaveRequest[];
  holidays: Holiday[];
  scopeLabel: string;
};

const statusStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-500/[0.04]', border: 'border-amber-500/10', text: 'text-amber-700/90', dot: 'bg-amber-500' },
  approved: { bg: 'bg-orange-500/[0.04]', border: 'border-orange-500/10', text: 'text-orange-700/90', dot: 'bg-orange-500' },
  rejected: { bg: 'bg-rose-500/[0.04]', border: 'border-rose-500/10', text: 'text-rose-700/90', dot: 'bg-rose-500' },
  cancelled: { bg: 'bg-neutral-500/[0.04]', border: 'border-neutral-500/10', text: 'text-neutral-550/90', dot: 'bg-neutral-400' },
};

export default function Calendar({ leaveEvents, holidays, scopeLabel }: Props) {
  const todayKey = dateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [isMobilePopupOpen, setIsMobilePopupOpen] = useState(false);
  const [isTimelineCompact, setIsTimelineCompact] = useState(false);
  
  const upcomingLeave = leaveEvents
    .filter((event) => event.status === 'approved' && parseDateKey(toDateKey(event.ends_at)) >= startOfToday())
    .slice(0, 12);
  const upcomingHolidays = holidays
    .filter((holiday) => {
      const holidayDate = parseDateKey(toDateKey(holiday.holiday_date));
      const today = startOfToday();
      const soonThreshold = addDays(today, 30);
      return holidayDate >= today && holidayDate <= soonThreshold;
    })
    .slice(0, 12);
  
  const filteredEventsForTimeline = useMemo(() => {
    const nextMonth = addMonths(visibleMonth, 1);
    
    const leavesInMonth = leaveEvents.filter((event) => {
      const starts = parseDateKey(toDateKey(event.starts_at));
      const ends = parseDateKey(toDateKey(event.ends_at));
      return starts < nextMonth && ends >= visibleMonth;
    });

    const holidaysInMonth = holidays.filter((holiday) => {
      const date = parseDateKey(toDateKey(holiday.holiday_date));
      return date >= visibleMonth && date < nextMonth;
    });

    return [
      ...leavesInMonth.map((event) => ({ kind: 'leave' as const, date: event.starts_at, event })),
      ...holidaysInMonth.map((holiday) => ({ kind: 'holiday' as const, date: holiday.holiday_date, holiday }))
    ];
  }, [visibleMonth, leaveEvents, holidays]);

  const monthGroups = useMemo(() => groupByMonth(filteredEventsForTimeline), [filteredEventsForTimeline]);
  
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth, leaveEvents, holidays), [visibleMonth, leaveEvents, holidays]);
  const selectedItems = calendarDays.find((day) => day.key === selectedDay)?.items ?? itemsForDate(selectedDay, leaveEvents, holidays);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page title header */}
        <div className="flex flex-wrap items-center justify-between gap-5 border-b border-neutral-100 pb-6">
          <div>
            <h2 className="text-2xl font-medium tracking-tight text-neutral-800">Coverage Calendar</h2>
            <p className="text-sm font-medium text-neutral-500 mt-1.5">{scopeLabel} for leave schedules, holidays, and upcoming coverage</p>
          </div>
          <div className="inline-flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-5 py-3 text-sm font-medium text-neutral-600 shadow-premium-sm">
            <CalendarDays size={15} className="text-neutral-400" /> 
            <span>{leaveEvents.length} leave requests · {holidays.length} holidays</span>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_310px]">
          {/* Main sections */}
          <div className="space-y-8">
            {/* Grid Month calendar */}
            <section className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-5 border-b border-neutral-200 px-6 py-6 bg-neutral-50/20">
                <div>
                  <h3 className="font-medium text-neutral-800 text-base">{visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
                  <p className="text-sm font-medium text-neutral-400 mt-1">Leave, holidays, and daily summaries</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer active:scale-95"
                    type="button"
                    onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer active:scale-95 shadow-premium-sm"
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setVisibleMonth(startOfMonth(now));
                      setSelectedDay(dateKey(now));
                    }}
                  >
                    Today
                  </button>
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer active:scale-95"
                    type="button"
                    onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/10 text-center text-sm font-medium uppercase tracking-wider text-neutral-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-4">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid cells */}              <div className="grid grid-cols-7 bg-neutral-200 gap-[1px]">
                {calendarDays.map((day) => {
                  const isSelected = day.key === selectedDay;
                  const isToday = day.key === todayKey;
                  return (
                    <button
                      key={day.key}
                      className={`min-h-[65px] sm:min-h-[120px] p-2.5 text-left transition-all hover:bg-neutral-50/60 flex flex-col justify-between cursor-pointer outline-none relative ${
                      day.isCurrentMonth ? 'bg-white' : 'bg-neutral-50/30 text-neutral-400'
                      } ${isSelected ? 'ring-2 ring-inset ring-orange-600 z-10' : ''}`}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day.key);
                        setIsMobilePopupOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md text-sm font-medium transition-all ${
                            isToday
                              ? 'bg-orange-600 text-white shadow-md shadow-orange-500/10'
                              : 'text-neutral-700'
                          }`}
                        >
                          {day.date.getDate()}
                        </span>
                        {day.items.length > 0 && (
                          <span className="hidden sm:inline-block text-xs font-medium text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-2 py-0.5">
                            {day.items.length}
                          </span>
                        )}
                      </div>
                      
                      {/* Desktop list view */}
                      <div className="hidden sm:block mt-3 space-y-1.5 w-full flex-1 overflow-y-auto">
                        {day.items.slice(0, 3).map((item) => {
                          const isHoliday = item.kind === 'holiday';
                          const statusStyle = !isHoliday ? statusStyles[item.status] : null;
                          return (
                            <div
                              key={item.id}
                              className={`truncate rounded-md px-2 py-1 text-xs font-medium border transition-colors ${
                                isHoliday
                                  ? 'bg-indigo-50/60 border-indigo-100 text-indigo-800'
                                  : `${statusStyle?.bg ?? 'bg-neutral-50'} ${statusStyle?.border ?? 'border-neutral-200'} ${statusStyle?.text ?? 'text-neutral-700'}`
                                }`}
                            >
                              {item.title}
                            </div>
                          );
                        })}
                        {day.items.length > 3 && (
                          <div className="text-xs font-medium text-neutral-500 px-1 mt-0.5">
                            +{day.items.length - 3} more
                          </div>
                        )}
                      </div>

                      {/* Mobile dot indicator view */}
                      <div className="flex sm:hidden flex-wrap gap-0.5 justify-center mt-1.5 w-full">
                        {day.items.slice(0, 3).map((item) => {
                          const isHoliday = item.kind === 'holiday';
                          const statusStyle = !isHoliday ? statusStyles[item.status] : null;
                          return (
                            <span
                              key={item.id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                isHoliday ? 'bg-indigo-500' : statusStyle?.dot ?? 'bg-neutral-400'
                              }`}
                            />
                          );
                        })}
                        {day.items.length > 3 && (
                          <span className="text-xs font-medium text-neutral-500 leading-none">+</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Calendar color legend */}
              <div className="flex flex-wrap gap-x-6 gap-y-2.5 bg-neutral-50/30 border-t border-neutral-200/80 px-6 py-4 text-xs text-neutral-500 font-medium">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500 shadow-xs" />
                  <span>Approved Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shadow-xs" />
                  <span>Pending Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-xs" />
                  <span>Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500 shadow-xs" />
                  <span>Rejected Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-neutral-400 shadow-xs" />
                  <span>Cancelled Leave</span>
                </div>
              </div>
            </section>
            {/* Timeline Row cards */}
            <section className="rounded-xl border border-neutral-200/50 bg-white shadow-premium-sm overflow-hidden">
              <div className="border-b border-neutral-200 px-6 py-5 bg-neutral-50/20 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="font-medium text-neutral-800 text-sm">Monthly Timeline</h3>
                  <p className="text-sm font-medium text-neutral-500 mt-1.5">View of team leave and corporate holidays for this month</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Detailed/Compact Toggle Button */}
                  <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/60 p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setIsTimelineCompact(false)}
                      className={`rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                        !isTimelineCompact 
                          ? 'bg-white text-neutral-800 shadow-premium-sm font-semibold' 
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      Detailed
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTimelineCompact(true)}
                      className={`rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                        isTimelineCompact 
                          ? 'bg-white text-neutral-800 shadow-premium-sm font-semibold' 
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      Compact
                    </button>
                  </div>
                  <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2.5 py-1.5">
                    {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-neutral-100">
                {monthGroups.map((group) => (
                  <div key={group.month} className="grid gap-4 px-6 py-6 md:grid-cols-[180px_1fr]">
                    {/* <div className="text-sm font-medium uppercase tracking-wider text-neutral-500 pt-2">
                      {group.month}
                    </div> */}
                    <div className="space-y-3 col-span-2">
                      {group.items.map((item) =>
                        item.kind === 'leave' ? (
                          <LeaveRow key={`leave-${item.event.id}`} event={item.event} compact={isTimelineCompact} />
                        ) : (
                          <HolidayRow key={`holiday-${item.holiday.id}`} holiday={item.holiday} compact={isTimelineCompact} />
                        )
                      )}
                    </div>
                  </div>
                ))}
                {monthGroups.length === 0 && (
                  <div className="px-6 py-12 text-center text-sm text-neutral-400 font-medium">
                    No scheduled items for this period.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-6">
            <div className="hidden lg:block">
              <Panel icon={<StickyNote size={15} />} title={formatSelectedDay(selectedDay)} empty="No notes for this day.">
                {selectedItems.map((item) =>
                  item.kind === 'leave' ? (
                    <LeaveNote key={item.id} item={item} />
                  ) : (
                    <HolidayNote key={item.id} item={item} />
                  )
                )}
              </Panel>
            </div>

            <Panel icon={<Umbrella size={15} />} title="Upcoming Team Leave" empty="No upcoming leave.">
              {upcomingLeave.map((event) => (
                <CompactLeaveRow key={event.id} event={event} />
              ))}
            </Panel>

            <Panel icon={<CalendarClock size={15} />} title="Upcoming Holidays" empty="No upcoming holidays.">
              {upcomingHolidays.map((holiday) => (
                <CompactHolidayRow key={holiday.id} holiday={holiday} />
              ))}
            </Panel>
          </aside>
        </div>
      </div>

      {/* Mobile Day Details Popup */}
      {isMobilePopupOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:hidden animate-fade-in">
          {/* Backdrop with smooth blur */}
          <div 
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity duration-300" 
            onClick={() => setIsMobilePopupOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 shadow-premium-lg border border-neutral-100 transition-all duration-300 max-h-[85vh] flex flex-col z-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <StickyNote size={18} className="text-orange-500" />
                <span className="font-semibold text-lg text-neutral-800">{formatSelectedDay(selectedDay)}</span>
              </div>
              <button 
                onClick={() => setIsMobilePopupOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-150 hover:text-neutral-700 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              {selectedItems.length > 0 ? (
                selectedItems.map((item) =>
                  item.kind === 'leave' ? (
                    <LeaveNote key={item.id} item={item} />
                  ) : (
                    <HolidayNote key={item.id} item={item} />
                  )
                )
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-neutral-400 font-medium">No leave or holidays scheduled for this day.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 border-t border-neutral-100 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMobilePopupOpen(false)}
                className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors active:scale-[0.98] shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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

function CompactLeaveRow({ event }: { event: LeaveRequest }) {
  const initials = event.user?.name
    ? event.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SE';

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 border-b border-neutral-100 last:border-0">
      {/* Initials Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs font-semibold text-orange-700 border border-orange-100/60">
        {initials}
      </div>
      
      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-800 truncate">{event.user?.name ?? 'Staff Employee'}</span>
          <LeaveBadge code={event.leave_type.code} name={event.leave_type.name} />
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {formatShortDate(event.starts_at)} – {formatShortDate(event.ends_at)}
        </div>
      </div>
    </div>
  );
}

function CompactHolidayRow({ holiday }: { holiday: Holiday }) {
  return (
    <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 border-b border-neutral-100 last:border-0">
      {/* Indigo Calendar Accent Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-650 border border-indigo-100/60">
        <Umbrella size={14} className="text-indigo-600" />
      </div>
      
      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-neutral-800 truncate">{holiday.name}</div>
        <div className="text-xs text-neutral-500 mt-0.5">
          {formatDate(holiday.holiday_date)}
        </div>
      </div>
    </div>
  );
}

function LeaveRow({ event, compact = false }: { event: LeaveRequest; compact?: boolean }) {
  const statusStyle = statusStyles[event.status] ?? { bg: 'bg-neutral-50 border-neutral-200', text: 'text-neutral-600', dot: 'bg-neutral-400' };
  
  return (
    <div className={`rounded-lg border border-neutral-100 bg-white ${compact ? 'p-3' : 'p-5'} shadow-premium-sm transition-all hover:shadow-premium-md`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-neutral-800">{event.user?.name ?? 'Staff Employee'}</div>
          <div className={`text-sm text-neutral-500 font-medium inline-flex items-center ${compact ? 'mt-1' : 'mt-2'}`}>
            <LeaveBadge code={event.leave_type.code} name={event.leave_type.name} variant="minimal" />
            <span className="mx-1 text-neutral-300">·</span>
            <span className="whitespace-nowrap text-xs font-medium text-neutral-700">{formatShortDate(event.starts_at)} – {formatShortDate(event.ends_at)}</span>
          </div>
          {event.user?.department?.name && !compact && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Reason & Notes
              </div>
              <p className="mt-1 text-xs text-neutral-500 font-normal line-clamp-3 italic">
                {event.reason || 'No handover notes provided.'}
              </p>
            </div>
          )}
        </div>
        <span className={`inline-flex items-center rounded-md border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} ${compact ? 'px-2 py-0.5' : 'px-2.5 py-0.5'} text-xs font-semibold tracking-wide transition-all duration-300`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot} mr-1.5 shrink-0`} />
          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
        </span>
      </div>
    </div>
  );
}

function HolidayRow({ holiday, compact = false }: { holiday: Holiday; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-indigo-100 bg-indigo-50/40 ${compact ? 'p-3' : 'p-5'} shadow-premium-sm`}>
      <div className="text-sm font-medium text-indigo-900">{holiday.name}</div>
      <div className="text-sm text-indigo-650 mt-1 font-medium">
        {formatDate(holiday.holiday_date)}
      </div>
    </div>
  );
}

function Panel({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="rounded-xl border border-neutral-200/50 bg-white p-5 shadow-premium-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-neutral-800">
        <div className="text-neutral-400">{icon}</div>
        <span>{title}</span>
      </div>
      <div className="space-y-3">
        {children.length > 0 ? (
          children
        ) : (
          <p className="py-3 text-center text-sm text-neutral-400 font-medium">{empty}</p>
        )}
      </div>
    </div>
  );
}

function LeaveNote({ item }: { item: Extract<CalendarItem, { kind: 'leave' }> }) {
  const statusStyle = statusStyles[item.status] ?? { bg: 'bg-neutral-50 border-neutral-200', text: 'text-neutral-600', dot: 'bg-neutral-400' };
  
  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-premium-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-neutral-800">{item.event.user?.name ?? 'Employee'}</div>
          
        </div>
        <span className={`inline-flex items-center rounded-md border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text} px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-300`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot} mr-1.5 shrink-0`} />
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
      </div>
      <div className="text-xs text-neutral-500 mt-1 font-medium inline-flex items-center">
            <LeaveBadge code={item.event.leave_type.code} name={item.event.leave_type.name} variant="minimal" />
            <span className="mx-1 text-neutral-300">·</span>
            <span>{formatDays(item.event.requested_days)} day(s)</span>
          </div>
      {item.event.reason && (
        <div className="mt-2.5 rounded-md bg-neutral-50/50 p-3 text-sm text-neutral-600 leading-relaxed italic border border-neutral-100/60">
          "{item.event.reason}"
        </div>
      )}
    </div>
  );
}

function HolidayNote({ item }: { item: Extract<CalendarItem, { kind: 'holiday' }> }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 shadow-premium-sm">
      <div className="text-sm font-medium text-indigo-900">{item.holiday.name}</div>
      <div className="text-sm text-indigo-600 mt-1.5 font-medium">
        {formatDate(item.holiday.holiday_date)}
      </div>
    </div>
  );
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
