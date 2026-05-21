export type User = {
  id: number;
  name: string;
  email: string;
  profile_photo?: string | null;
  role: 'staff' | 'manager' | 'hr' | 'admin';
  employee_code?: string | null;
  job_title?: string | null;
  hire_date?: string | null;
  department?: { id: number; name: string } | null;
  manager?: { id: number; name: string } | null;
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
  submitted_at?: string | null;
  decided_at?: string | null;
  created_at?: string;
  user?: User;
  approver?: User | null;
  leave_type: LeaveType;
  attachments?: { id: number; original_name: string; path: string; mime_type: string }[];
};

export type PageProps = {
  auth: { user: User; must_change_password?: boolean };
  flash: { success?: string; error?: string; default_password?: string };
  errors: Record<string, string>;
};
