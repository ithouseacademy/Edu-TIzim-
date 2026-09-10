export interface Employee {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  gender: string
  gender_display: string
  birth_date: string | null
  photo: string | null
  position: { id: number; name: string } | null
  role: { id: number; name: string } | null
  branches: { id: number; name: string }[]
  salary_enabled: boolean
  salary_type: string
  salary_type_display: string
  percent: number
  monthly_salary: number
  salary: number | null
  teacher_balance: number
  notes: string
  has_login: boolean
  group_count: number
  created_at: string
}

export interface LoginResponse {
  success: boolean
  employee: Employee
  is_admin: boolean
  is_teacher: boolean
  is_super_admin: boolean
  permissions: string[]
}

export interface MeResponse {
  employee: Employee & {
    is_teacher: boolean
    username: string
    is_super_admin: boolean
    permissions: string[]
  }
}

export interface AdminGroup {
  id: number
  name: string
  course: string | null
  room: string | null
  status: string
  status_display: string
  student_count: number
  teacher: string | null
  lesson_times: { days: string; start_time: string; end_time: string }[]
  start_date: string | null
  end_date: string | null
}

export interface DashboardGroup {
  id: number
  name: string
  course: string | null
  room: string | null
  student_count: number
  status: string
  status_display: string
  lesson_display: string
  nearest_time: string | null
  start_date: string | null
  end_date: string | null
}

export interface DashboardData {
  groups: DashboardGroup[]
  today_display: string
  total_groups: number
  today_count: number
  active_count: number
  total_students: number
}

export interface AdminTransaction {
  id: number
  amount: number
  amount_str: string
  balance_after: number
  balance_after_str: string
  type: string
  type_display: string
  student_name: string
  group: string
  description: string
  created_by: string
  created_at: string
  date: string
}

export interface StudentItem {
  id: number
  first_name: string
  last_name: string
  phone: string
  balance: number
  balance_str: string
  status: string
  status_display: string
  groups: string[]
  groups_str: string
  created_at: string
}

export interface StudentGroupItem {
  id: number
  name: string
  status: string
  status_display: string
  graduated?: boolean
}

export interface StudentTxItem {
  id: number
  amount: number
  amount_str: string
  type: string
  type_display: string
  group: string
  description: string
  created_by: string
  created_at: string
}

export interface StudentDetailResponse {
  student: {
    id: number
    first_name: string
    last_name: string
    phone: string
    email: string
    birth_date: string
    status: string
    status_display: string
    created_at: string
    school: string
    father_full_name: string
    father_phone: string
    father_workplace: string
    mother_full_name: string
    mother_phone: string
    mother_workplace: string
    home_address: string
    additional_info: string
    education_language: string
    education_types: string[]
    balance: number
    balance_str: string
  }
  groups: StudentGroupItem[]
  debt: {
    monthly_debts: { label: string; debt: number }[]
    deferred_payments: { month: string; reason: string; label: string; debt: number }[]
    prev_debt: number
    current_expected: number
    total_owed: number
    remaining_lessons: number
    shu_kungacha: number
    oy_oxirigacha: number
  }
  transactions: StudentTxItem[]
  attendance_stats: {
    total: number
    present: number
    absent: number
  }
  attendance_history: {
    id: number
    date: string
    status: string
    status_display: string
    group: string
    teacher: string
    created_at: string
  }[]
  sms_history: {
    sms_type: string
    message: string
    recipient_name: string
    recipient_phone: string
    status: string
    created_at: string
  }[]
  logs: {
    id: number
    action: string
    action_display: string
    reason: string
    group: string
    created_by: string
    created_at: string
  }[]
}

export type StudentDetail = StudentDetailResponse

export interface AdminTransactionsResponse {
  transactions: AdminTransaction[]
  kassa_balance: number
  kassa_name: string
  today_income: number
  today_expense: number
  month_income: number
  month_expense: number
  total_income: number
  total_expense: number
}

export interface SalaryData {
  first_name: string
  last_name: string
  salary_type: string
  salary_type_display: string
  percent: number
  monthly_salary: number
  salary_enabled: boolean
  salary: number | null
  balance: number
  avans_balance: number
  today_income: number
  month_earned: number
  paid_total: number
  month_paid: number
  pending_amount: number
  pending_count: number
  unpaid: number
}

export interface AttendanceStudent {
  id: number
  first_name: string
  last_name: string
  phone: string
  balance: number
}

export interface AttendanceHistoryItem {
  date: string
  status: string
  notes: string
  teacher: string
}

export interface GroupAttendanceData {
  group: {
    id: number
    name: string
    course: string | null
    room: string | null
    teacher: string | null
    lesson_time: string
    start_date: string | null
    end_date: string | null
    remaining_days: number | null
  }
  students: AttendanceStudent[]
  lesson_dates: string[]
  att_matrix: Record<string, Record<string, string>>
  att_notes: Record<string, Record<string, string>>
  student_att_history: Record<string, AttendanceHistoryItem[]>
  absence_reasons: { id: number; name: string }[]
  sel_year: number
  sel_month: number
  is_admin: boolean
  can_edit: boolean
}