import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeDate(raw: string): string {
  if (!raw) return '';
  return raw.slice(0, 10);
}

function parseDate(raw: string): Date | null {
  const str = normalizeDate(raw);
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const normalizedValue = normalizeDate(value);
  const selected = parseDate(value);
  const todayObj = new Date();
  const todayStr = toDateStr(todayObj);

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? todayObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? todayObj.getMonth());

  useEffect(() => {
    if (open && selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const panelH = 380;
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= panelH ? r.bottom + 4 : r.top - panelH - 4;
      setPos({ top: Math.max(4, top), left: r.left });
    }
    reposition();

    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const normalizedMin = normalizeDate(minDate ?? '');

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    let startDay = first.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevDays = new Date(viewYear, viewMonth, 0).getDate();

    const result: { day: number; date: string; current: boolean; disabled: boolean }[] = [];

    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, date: ds, current: false, disabled: !!(normalizedMin && ds < normalizedMin) });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, date: ds, current: true, disabled: !!(normalizedMin && ds < normalizedMin) });
    }

    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, date: ds, current: false, disabled: !!(normalizedMin && ds < normalizedMin) });
    }

    return result;
  }, [viewYear, viewMonth, normalizedMin]);

  const displayValue = selected
    ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`flex w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm transition-colors ${
          open
            ? 'border-emerald-500 ring-1 ring-emerald-500'
            : normalizedValue
              ? 'border-slate-200 text-slate-900 hover:border-slate-300'
              : 'border-slate-200 text-slate-400 hover:border-slate-300'
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        <Calendar size={16} className={open ? 'text-emerald-600' : 'text-slate-400'} />
        <span className="flex-1 truncate">{displayValue || 'Select date'}</span>
      </button>
      {label && <span className="mt-1 block text-[11px] text-slate-400">{label}</span>}

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[200] w-[296px] animate-[scaleIn_0.12s_ease-out] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="mb-3 flex items-center justify-between">
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100" onClick={prevMonth}>
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100" onClick={nextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center">
            {DAY_LABELS.map((d) => (
              <span key={d} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c, idx) => {
              const isSelected = normalizedValue === c.date;
              const isToday = c.date === todayStr && c.current;
              const isWeekend = idx % 7 >= 5;

              return (
                <button
                  key={`${c.date}-${idx}`}
                  type="button"
                  disabled={c.disabled}
                  className={`flex h-9 w-full items-center justify-center rounded-lg text-[13px] font-medium transition-colors ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : c.disabled
                        ? 'cursor-not-allowed text-slate-200'
                        : !c.current
                          ? 'text-slate-300 hover:bg-slate-50'
                          : isToday
                            ? 'bg-emerald-50 font-semibold text-emerald-700 hover:bg-emerald-100'
                            : isWeekend
                              ? 'text-slate-400 hover:bg-slate-50'
                              : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    onChange(c.date);
                    setOpen(false);
                  }}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
              onClick={() => { onChange(''); setOpen(false); }}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
              onClick={() => {
                const t = todayStr;
                if (!normalizedMin || t >= normalizedMin) { onChange(t); setOpen(false); }
              }}
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
