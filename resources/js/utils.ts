export function formatDays(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  const currentYear = new Date().getFullYear();
  const includeYear = date.getFullYear() !== currentYear;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRole(role: string): string {
  if (role === 'hr admin') return 'HR Admin';

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function canApproveRole(role: string): boolean {
  return ['manager', 'hr admin', 'admin'].includes(role);
}

export function canAdminRole(role: string): boolean {
  return ['hr admin', 'admin'].includes(role);
}
