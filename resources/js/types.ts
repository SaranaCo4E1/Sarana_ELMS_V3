export type User = {
  id: number;
  name: string;
  email: string;
  role: 'staff' | 'manager' | 'hr' | 'admin';
  department?: { id: number; name: string } | null;
};

export type LeaveType = {
  id: number;
  name: string;
  code: string;
  default_allowance_days: string;
  requires_attachment: boolean;
};

export type LeaveBalance = {
  id: number;
  allowance_days: string;
  used_days: string;
  pending_days: string;
  available_days: number;
  leave_type: LeaveType;
};

export type LeaveRequest = {
  id: number;
  starts_at: string;
  ends_at: string;
  requested_days: string;
  status: string;
  reason: string;
  manager_comment?: string | null;
  user?: User;
  leave_type: LeaveType;
  attachments?: { id: number; original_name: string }[];
};

export type PageProps = {
  auth: { user: User };
  flash: { success?: string; error?: string };
  errors: Record<string, string>;
};
