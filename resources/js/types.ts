export type User = {
  id: number;
  name: string;
  email: string;
  role: 'staff' | 'manager' | 'hr' | 'admin';
  employee_code?: string | null;
  job_title?: string | null;
  phone?: string | null;
  work_location?: string | null;
  employment_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  bio?: string | null;
  hire_date?: string | null;
  is_active?: boolean;
  two_factor_enabled?: boolean;
  department?: { id: number; name: string } | null;
  manager?: { id: number; name: string } | null;
  pending_leave_requests_count?: number;
  approved_leave_requests_count?: number;
};

export type LeaveType = {
  id: number;
  name: string;
  code: string;
  default_allowance_days: string;
  paid: boolean;
  requires_attachment: boolean;
  deducts_balance: boolean;
  is_active: boolean;
  balances_count?: number;
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
  user?: User;
  approver?: User;
  leave_type: LeaveType;
  attachments?: { id: number; original_name: string }[];
};

export type SystemNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  action_url?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type PageProps = {
  auth: { user: User };
  notifications: {
    items: SystemNotification[];
    unread_count: number;
  };
  flash: { success?: string; error?: string };
  errors: Record<string, string>;
};
