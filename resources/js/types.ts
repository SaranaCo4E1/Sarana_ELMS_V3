export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
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
  profile?: UserProfile | null;
  department?: { id: number; name: string } | null;
  manager?: { id: number; name: string } | null;
  pending_leave_requests_count?: number;
  approved_leave_requests_count?: number;
  leave_balances?: LeaveBalance[];
};

export type UserProfile = {
  id: number;
  user_id: number;
  date_of_birth?: string | null;
  gender?: 'Male' | 'Female' | null;
  nationality?: string | null;
  national_id_number?: string | null;
  join_date?: string | null;
  employment_type?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  profile_picture_url?: string | null;
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
  leave_type_id: number;
  year: number;
  allowance_days: string;
  carried_forward_days: string;
  used_days: string;
  pending_days: string;
  adjustment_days: string;
  available_days: number;
  override_reason?: string | null;
  leave_type: LeaveType;
};

export type LeaveRequest = {
  id: number;
  starts_at: string;
  ends_at: string;
  requested_days: string;
  status: string;
  reason: string | null;
  manager_comment?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  user?: User;
  approver?: User;
  leave_type: LeaveType;
  attachments?: { id: number; original_name: string; mime_type?: string | null; path?: string }[];
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

export type Permission = {
  id: number;
  key: string;
  name: string;
  group: string;
  description?: string | null;
};

export type Role = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  users_count?: number;
  permissions?: Permission[];
};

export type PageProps = {
  auth: { user: User; permissions: string[]; pending_approvals_count: number };
  notifications: {
    items: SystemNotification[];
    unread_count: number;
  };
  flash: { success?: string; error?: string };
  errors: Record<string, string>;
};

export type PublicHoliday = {
  id: number;
  holiday_date: string;
  name: string;
  is_active: boolean;
};
