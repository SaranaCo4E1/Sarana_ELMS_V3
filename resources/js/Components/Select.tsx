import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = { value: string; label: string };

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  icon,
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === String(value));
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const panelH = options.length > 7 ? 280 : Math.min(options.length * 36 + 8, 250);
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= panelH ? r.bottom + 4 : r.top - panelH - 4;
      setPos({ top: Math.max(4, top), left: r.left, width: r.width });
    }
    reposition();

    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (open && inputRef.current && options.length > 7) {
      inputRef.current.focus();
    }
  }, [open, options.length]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`flex w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm transition-colors ${
          open
            ? 'border-emerald-500 ring-1 ring-emerald-500'
            : selected
              ? 'border-slate-200 text-slate-900 hover:border-slate-300'
              : 'border-slate-200 text-slate-400 hover:border-slate-300'
        }`}
        onClick={() => { setOpen((v) => !v); setSearch(''); }}
      >
        {icon && <span className={open ? 'text-emerald-600' : 'text-slate-400'}>{icon}</span>}
        <span className="flex-1 truncate">{selected?.label || placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[200] animate-[scaleIn_0.1s_ease-out] rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.length > 7 && (
            <div className="border-b border-slate-100 px-3 pb-2 pt-1.5">
              <input
                ref={inputRef}
                type="text"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-slate-400">No results</div>
            )}
            {filtered.map((opt) => {
              const isActive = String(value) === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isActive && <Check size={14} className="shrink-0 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
