import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type AttendancePunchPreview = {
  classification: 'morning_in' | 'lunch_out' | 'lunch_in' | 'final_out' | 'ordinary';
  status: 'on_time' | 'early' | 'late' | 'ordinary';
  expected_at?: string | null;
};

const milestoneLabels: Record<AttendancePunchPreview['classification'], string> = {
  morning_in: 'Morning check-in',
  lunch_out: 'Lunch check-out',
  lunch_in: 'Lunch check-in',
  final_out: 'Final check-out',
  ordinary: 'Ordinary movement',
};

export default function AttendanceTimingNotice({ preview }: { preview?: AttendancePunchPreview | null }) {
  if (!preview) return null;

  const milestone = milestoneLabels[preview.classification];
  const expectedTime = preview.expected_at
    ? new Date(preview.expected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const presentation = {
    on_time: {
      Icon: CheckCircle2,
      title: `On schedule · ${milestone}`,
      message: expectedTime
        ? `This punch is within the expected timing for ${milestone.toLowerCase()} at ${expectedTime}.`
        : 'This punch is within the expected attendance window.',
      classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
      iconClasses: 'text-emerald-600',
    },
    early: {
      Icon: AlertTriangle,
      title: `Early · ${milestone}`,
      message: `The scheduled time is ${expectedTime ?? 'later'}. Confirming now will mark this punch as early.`,
      classes: 'border-amber-200 bg-amber-50/80 text-amber-950',
      iconClasses: 'text-amber-600',
    },
    late: {
      Icon: AlertTriangle,
      title: `Late · ${milestone}`,
      message: `The scheduled time was ${expectedTime ?? 'earlier'}. Confirming now will mark this punch as late.`,
      classes: 'border-rose-200 bg-rose-50/80 text-rose-950',
      iconClasses: 'text-rose-600',
    },
    ordinary: {
      Icon: Info,
      title: milestone,
      message: 'This punch is outside a scheduled milestone and will be recorded as an ordinary movement.',
      classes: 'border-blue-200 bg-blue-50/80 text-blue-900',
      iconClasses: 'text-blue-600',
    },
  }[preview.status];
  const { Icon } = presentation;

  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${presentation.classes}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${presentation.iconClasses}`} />
      <div>
        <p className="text-sm font-semibold">{presentation.title}</p>
        <p className="mt-1 text-xs leading-5 opacity-80">{presentation.message}</p>
      </div>
    </div>
  );
}
