import type React from 'react';

export interface LeaveStyle {
  bg: string;
  border: string;
  text: string;
  dot: string;
  bar: string;
}

export const getLeaveStyle = (codeOrName: string): LeaveStyle => {
  const c = codeOrName.toLowerCase();
  if (c === 'al' || c.includes('annual')) {
    return {
      bg: 'bg-blue-500/[0.04]',
      border: 'border-blue-500/10',
      text: 'text-blue-700/90',
      dot: 'bg-blue-500',
      bar: 'bg-blue-500',
    };
  }
  if (c === 'sl' || c.includes('sick')) {
    return {
      bg: 'bg-rose-500/[0.04]',
      border: 'border-rose-500/10',
      text: 'text-rose-700/90',
      dot: 'bg-rose-500',
      bar: 'bg-rose-500',
    };
  }
  if (c === 'el' || c.includes('emerg') || c.includes('cas') || c.includes('unpaid') || c === 'ul') {
    return {
      bg: 'bg-amber-500/[0.04]',
      border: 'border-amber-500/10',
      text: 'text-amber-700/90',
      dot: 'bg-amber-500',
      bar: 'bg-amber-500',
    };
  }
  return {
    bg: 'bg-indigo-500/[0.04]',
    border: 'border-indigo-500/10',
    text: 'text-indigo-700/90',
    dot: 'bg-indigo-500',
    bar: 'bg-indigo-500',
  };
};

type Props = {
  code?: string;
  name?: string;
  className?: string;
  useShortCode?: boolean;
  variant?: 'pill' | 'minimal';
};

export default function LeaveBadge({ code, name, className = '', useShortCode = false, variant = 'pill' }: Props) {
  const identifier = code || name || 'default';
  const displayName = useShortCode ? (code || name || '').toUpperCase() : (name || code || '');
  const style = getLeaveStyle(identifier);

  if (variant === 'minimal') {
    return (
      <span
        className={`inline-flex items-center text-xs font-semibold ${style.text} tracking-wide shrink-0 ${className}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot} mr-1.5 shrink-0`} />
        {displayName}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border ${style.border} ${style.bg} ${style.text} px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-300 shrink-0 ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot} mr-1.5 shrink-0`} />
      {displayName}
    </span>
  );
}
